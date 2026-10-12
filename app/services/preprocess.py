"""Canvas drawing -> 28x28 EMNIST-style tensor.

EMNIST/MNIST glyphs are white ink on black, cropped to the ink bounding box, padded to a square with a small
margin and resized to 28x28 with anti-aliasing. Anything you draw must go through the SAME steps, otherwise
the model sees a distribution it was never trained on and the predictions are garbage. This file is the single
place where that happens; both the server and any offline test must call `canvas_to_28`.
"""
from __future__ import annotations

import base64
import io

import numpy as np
from PIL import Image, ImageFilter

MARGIN_FRAC = 0.12   # ink occupies ~76% of the 28px box, like EMNIST letters
INK_THRESHOLD = 20   # 0..255; below this is background


def decode_data_url(data_url: str) -> Image.Image:
    """'data:image/png;base64,....' -> PIL image (RGBA or L)."""
    payload = data_url.split(",", 1)[1] if "," in data_url else data_url
    return Image.open(io.BytesIO(base64.b64decode(payload)))


def to_ink_on_black(img: Image.Image) -> np.ndarray:
    """Return a uint8 grayscale array where ink is bright and background is 0."""
    if img.mode == "RGBA":
        # transparent canvas: use alpha as ink, ignore colour
        a = np.array(img.getchannel("A"), np.uint8)
        rgb = np.array(img.convert("L"), np.uint8)
        if a.max() > 0 and (a > 0).mean() < 0.5:
            return a
        img_l = rgb
    else:
        img_l = np.array(img.convert("L"), np.uint8)
    # dark ink on light background -> invert
    if img_l.mean() > 127:
        img_l = 255 - img_l
    return img_l


def canvas_to_28(img: Image.Image) -> np.ndarray | None:
    """PIL image of the whole canvas -> float32 (28,28) in [0,1], or None if the canvas is empty."""
    ink = to_ink_on_black(img)
    ys, xs = np.where(ink > INK_THRESHOLD)
    if len(xs) == 0:
        return None
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    crop = ink[y0:y1, x0:x1]
    h, w = crop.shape
    side = int(max(h, w) * (1 + 2 * MARGIN_FRAC)) + 1
    canvas = np.zeros((side, side), np.uint8)
    oy, ox = (side - h) // 2, (side - w) // 2
    canvas[oy:oy + h, ox:ox + w] = crop
    im = Image.fromarray(canvas).resize((28, 28), Image.Resampling.LANCZOS)
    im = im.filter(ImageFilter.GaussianBlur(0.4))
    arr = np.asarray(im, np.float32) / 255.0
    if arr.max() > 0:
        arr = arr / arr.max()
    return arr


def canvas_data_url_to_28(data_url: str) -> np.ndarray | None:
    return canvas_to_28(decode_data_url(data_url))
