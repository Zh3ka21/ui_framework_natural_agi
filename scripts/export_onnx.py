"""Export the trained CNNs to ONNX so the browser can run them (onnxruntime-web).

  python -m scripts.export_onnx        # models/cnn_letters.pt -> models/cnn_letters.onnx, same for digits
"""
import os

import torch

from app.ml.net import Net

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # project root

for name in ("letters", "digits", "mixed"):
    pt = os.path.join(HERE, "models", f"cnn_{name}.pt")
    if not os.path.exists(pt):
        continue
    ckpt = torch.load(pt, map_location="cpu")
    net = Net(len(ckpt["classes"])); net.load_state_dict(ckpt["state_dict"]); net.eval()
    out = os.path.join(HERE, "models", f"cnn_{name}.onnx")
    dummy = torch.zeros(1, 1, 28, 28)
    try:
        torch.onnx.export(net, dummy, out, input_names=["x"], output_names=["logits"], opset_version=17, dynamo=False)
    except TypeError:   # older torch without the dynamo flag
        torch.onnx.export(net, dummy, out, input_names=["x"], output_names=["logits"], opset_version=17)
    print("saved", out)
