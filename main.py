import io
import aiohttp
import torch
from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response, JSONResponse
from torchvision import transforms
from transformers import AutoModelForImageSegmentation

DEVICE = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
torch.set_num_threads(1)
torch.set_float32_matmul_precision("high")

IMAGE_SIZE = (1024, 1024)
_transform = transforms.Compose([
    transforms.Resize(IMAGE_SIZE),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],[0.229, 0.224, 0.225])
])

_model = AutoModelForImageSegmentation.from_pretrained(
    "briaai/RMBG-2.0",
    trust_remote_code=True
).to(DEVICE).eval()

app = FastAPI()

def _autocrop(png_bytes: bytes) -> bytes:
    im = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    alpha = im.split()[-1]
    bbox = alpha.getbbox()
    if bbox:
        im = im.crop(bbox)
    out = io.BytesIO()
    im.save(out, format="PNG")
    return out.getvalue()

def _remove_bg_bytes(src_bytes: bytes, crop: bool = True) -> bytes:
    im = Image.open(io.BytesIO(src_bytes)).convert("RGB")
    orig_w, orig_h = im.size
    inp = _transform(im).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        logits = _model(inp)[-1]
        pred = torch.sigmoid(logits).detach().cpu()
    pred = pred.squeeze()
    pred_pil = transforms.ToPILImage()(pred)
    mask = pred_pil.resize((orig_w, orig_h), Image.BILINEAR)
    im_rgba = im.convert("RGBA")
    im_rgba.putalpha(mask)
    buf = io.BytesIO()
    im_rgba.save(buf, format="PNG")
    out = buf.getvalue()
    return _autocrop(out) if crop else out

@app.get("/health")
async def health():
    return {"ok": True, "engine": "briaai/RMBG-2.0", "device": DEVICE}

@app.get("/rmbg_url")
async def rmbg_url(url: str, crop: bool = True):
    try:
        timeout = aiohttp.ClientTimeout(total=90)
        async with aiohttp.ClientSession(timeout=timeout) as sess:
            async with sess.get(url, allow_redirects=True) as r:
                if r.status != 200:
                    return JSONResponse({"error": f"Download failed {r.status}"}, status_code=400)
                data = await r.read()
        out_png = _remove_bg_bytes(data, crop=crop)
        return Response(
            content=out_png,
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=86400"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/rmbg")
async def rmbg(url: str, crop: bool = True):
    try:
        timeout = aiohttp.ClientTimeout(total=90)
        async with aiohttp.ClientSession(timeout=timeout) as sess:
            async with sess.get(url, allow_redirects=True) as r:
                if r.status != 200:
                    return JSONResponse({"error": f"Download failed {r.status}"}, status_code=400)
                data = await r.read()
        out_png = _remove_bg_bytes(data, crop=crop)
        return Response(content=out_png, media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
