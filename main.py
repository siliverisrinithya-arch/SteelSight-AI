from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from PIL import Image, UnidentifiedImageError
from io import BytesIO
from pathlib import Path

app = FastAPI(
    title="Industrial Steel Defect Detection API",
    description="YOLO11-based steel surface defect detection",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = Path(__file__).resolve().parent / "best.pt"

if not MODEL_PATH.exists():
    raise FileNotFoundError(f"Trained model not found at: {MODEL_PATH}")

model = YOLO(str(MODEL_PATH))


@app.get("/")
def home():
    return {
        "message": "Industrial Steel Defect Detection API is running!"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model_loaded": True
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Please upload an image file."
        )

    try:
        contents = await file.read()

        if not contents:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty."
            )

        image = Image.open(BytesIO(contents)).convert("RGB")

        results = model.predict(
            source=image,
            imgsz=640,
            conf=0.25,
            verbose=False
        )

        result = results[0]
        detections = []

        for box in result.boxes:
            class_id = int(box.cls[0])
            confidence = float(box.conf[0])
            coordinates = box.xyxy[0].tolist()

            detections.append({
                "class_id": class_id,
                "class_name": model.names[class_id],
                "confidence": round(confidence, 4),
                "bounding_box": [
                    round(float(value), 2)
                    for value in coordinates
                ]
            })

        return {
            "filename": file.filename,
            "image_width": image.width,
            "image_height": image.height,
            "total_detections": len(detections),
            "detections": detections
        }

    except HTTPException:
        raise

    except (UnidentifiedImageError, OSError):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid image."
        )

    finally:
        await file.close()
