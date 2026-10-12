"""Train a small CNN on EMNIST (letters, 26 classes) or MNIST (digits, 10 classes) and save it for the server.

  python train_cnn.py --dataset letters --epochs 5      # -> models/cnn_letters.pt
  python train_cnn.py --dataset digits  --epochs 3      # -> models/cnn_digits.pt
  python train_cnn.py --dataset mixed   --epochs 5      # -> models/cnn_mixed.pt  (letters + digits, 36 classes)

Downloads the data through torchvision on first run (EMNIST is a 560 MB archive, MNIST ~12 MB).
CPU is fine: one EMNIST epoch is ~1-2 min on a laptop; a GPU / Apple MPS is used automatically when present.
"""
from __future__ import annotations

import argparse, os, time
import torch, torch.nn as nn, torch.nn.functional as F
from torch.utils.data import DataLoader, TensorDataset
from torchvision import datasets

HERE = os.path.dirname(os.path.abspath(__file__))


class Net(nn.Module):
    """Same architecture the server loads. Keep the two in sync (server imports this class)."""

    def __init__(self, n_classes: int):
        super().__init__()
        self.c1 = nn.Conv2d(1, 32, 3, padding=1); self.c2 = nn.Conv2d(32, 64, 3, padding=1)
        self.c3 = nn.Conv2d(64, 128, 3, padding=1)
        self.bn1, self.bn2, self.bn3 = nn.BatchNorm2d(32), nn.BatchNorm2d(64), nn.BatchNorm2d(128)
        self.drop = nn.Dropout(0.3); self.fc1 = nn.Linear(128 * 3 * 3, 256); self.fc2 = nn.Linear(256, n_classes)

    def forward(self, x):
        x = F.max_pool2d(F.relu(self.bn1(self.c1(x))), 2)
        x = F.max_pool2d(F.relu(self.bn2(self.c2(x))), 2)
        x = F.max_pool2d(F.relu(self.bn3(self.c3(x))), 2)
        return self.fc2(self.drop(F.relu(self.fc1(x.flatten(1)))))


def load_dataset(name: str, root: str):
    if name == "mixed":      # 26 letters + 10 digits in one 36-class model
        Xl, yl, Xlt, ylt, cl = load_dataset("letters", root)
        Xd, yd, Xdt, ydt, cd = load_dataset("digits", root)
        return torch.cat([Xl, Xd]), torch.cat([yl, yd + 26]), torch.cat([Xlt, Xdt]), torch.cat([ylt, ydt + 26]), cl + cd
    if name == "letters":
        tr = datasets.EMNIST(root, split="letters", train=True, download=True)
        te = datasets.EMNIST(root, split="letters", train=False, download=True)
        # torchvision stores EMNIST transposed -> make glyphs upright
        Xtr = tr.data.transpose(1, 2).contiguous(); Xte = te.data.transpose(1, 2).contiguous()
        ytr, yte = tr.targets - 1, te.targets - 1
        classes = [chr(65 + i) for i in range(26)]
    elif name == "digits":
        tr = datasets.MNIST(root, train=True, download=True); te = datasets.MNIST(root, train=False, download=True)
        Xtr, Xte, ytr, yte = tr.data, te.data, tr.targets, te.targets
        classes = [str(i) for i in range(10)]
    else:
        raise ValueError(name)
    f = lambda X: X.float().unsqueeze(1) / 255.0
    return f(Xtr), ytr.long(), f(Xte), yte.long(), classes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", choices=["letters", "digits", "mixed"], default="letters")
    ap.add_argument("--epochs", type=int, default=5)
    ap.add_argument("--data-root", default=os.path.join(HERE, "data"))
    ap.add_argument("--out", default=None)
    ap.add_argument("--max-train", type=int, default=0, help="debug: use only N training images")
    args = ap.parse_args()

    dev = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
    torch.manual_seed(0)
    Xtr, ytr, Xte, yte, classes = load_dataset(args.dataset, args.data_root)
    if args.max_train:
        Xtr, ytr = Xtr[: args.max_train], ytr[: args.max_train]
    print(f"device={dev} train={len(Xtr)} test={len(Xte)} classes={len(classes)}")

    import torchvision.transforms.v2 as T
    aug = T.RandomAffine(degrees=10, translate=(0.06, 0.06), scale=(0.9, 1.1), shear=6)

    net = Net(len(classes)).to(dev)
    opt = torch.optim.AdamW(net.parameters(), lr=2e-3, weight_decay=1e-4)
    loader = DataLoader(TensorDataset(Xtr, ytr), batch_size=256, shuffle=True)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=3e-3, total_steps=args.epochs * len(loader))

    for ep in range(args.epochs):
        net.train(); t0 = time.time(); tot = 0.0
        for xb, yb in loader:
            xb = aug(xb).to(dev); yb = yb.to(dev)
            loss = F.cross_entropy(net(xb), yb, label_smoothing=0.05)
            opt.zero_grad(); loss.backward(); opt.step(); sched.step(); tot += loss.item()
        net.eval(); correct = 0
        with torch.no_grad():
            for i in range(0, len(Xte), 2048):
                correct += (net(Xte[i:i + 2048].to(dev)).argmax(1).cpu() == yte[i:i + 2048]).sum().item()
        print(f"epoch {ep + 1}/{args.epochs}  loss {tot / len(loader):.3f}  test acc {correct / len(Xte):.4f}  "
              f"{time.time() - t0:.0f}s")

    out = args.out or os.path.join(HERE, "models", f"cnn_{args.dataset}.pt")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    torch.save({"state_dict": net.state_dict(), "classes": classes}, out)
    print("saved", out)


if __name__ == "__main__":
    main()
