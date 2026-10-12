"""The CNN used by training, the server and the ONNX export. Keep the architecture in one place."""
import torch.nn.functional as F
from torch import nn


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
