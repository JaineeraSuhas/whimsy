/**
 * face-detection.ts — MediaPipe Tasks Vision (WASM-accelerated)
 *
 * WHY: face-api.js uses a CDN + runs on CPU → always times out on large images.
 * MediaPipe Tasks Vision uses WASM/WebGL, loads from a single CDN bundle,
 * and is 3-10x faster with no per-image model loading overhead.
 *
 * Install: npm install @mediapipe/tasks-vision
 */

import {
  FaceDetector,
  FaceLandmarker,
  FilesetResolver,
  type FaceDetectorResult,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FaceDetection {
  id: string;
  box: { x: number; y: number; width: number; height: number };
  descriptor: Float32Array; // 128-dim pseudo-descriptor derived from landmarks
  landmarks?: { positions: { x: number; y: number; z?: number }[] };
  score?: number;
  quality?: number;
  skinTone?: { r: number; g: number; b: number };
  rotationApplied?: 0 | 90 | 180 | 270;
  scalePyramidPass?: boolean;
  likelyFalsePositive?: boolean;
  preprocessingMs?: number;
}

// ─── Singleton Models ─────────────────────────────────────────────────────────

let faceDetector: FaceDetector | null = null;
let faceLandmarker: FaceLandmarker | null = null;
let modelLoadPromise: Promise<void> | null = null;

const MEDIAPIPE_WASM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

/**
 * Load MediaPipe models once — subsequent calls return immediately.
 * Both models are cached by the browser after first load.
 */
export async function loadFaceDetectionModel(): Promise<void> {
  if (faceDetector && faceLandmarker) return;

  if (modelLoadPromise) return modelLoadPromise;

  modelLoadPromise = (async () => {
    console.log("[FaceDetection] Loading MediaPipe WASM models...");
    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);

    [faceDetector, faceLandmarker] = await Promise.all([
      FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
          delegate: "GPU", // Falls back to CPU automatically
        },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.2,
        minSuppressionThreshold: 0.3,
      }),
      FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float32/1/face_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        numFaces: 10,
        minFaceDetectionConfidence: 0.2,
        minFacePresenceConfidence: 0.2,
        minTrackingConfidence: 0.2,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      }),
    ]);

    console.log("[FaceDetection] Models ready ✅");
  })();

  return modelLoadPromise;
}

// ─── Core Detection ───────────────────────────────────────────────────────────

function applyUnsharpMask(imageData: ImageData, w: number, h: number): ImageData {
  const data = imageData.data;
  const out = new Uint8ClampedArray(data.length);
  const kernel = [
    0, -1,  0,
   -1,  5, -1,
    0, -1,  0
  ];
  
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        let val = 0;
        val += data[((y - 1) * w + (x - 1)) * 4 + c] * kernel[0];
        val += data[((y - 1) * w + x) * 4 + c] * kernel[1];
        val += data[((y - 1) * w + (x + 1)) * 4 + c] * kernel[2];
        val += data[(y * w + (x - 1)) * 4 + c] * kernel[3];
        val += data[(y * w + x) * 4 + c] * kernel[4];
        val += data[(y * w + (x + 1)) * 4 + c] * kernel[5];
        val += data[((y + 1) * w + (x - 1)) * 4 + c] * kernel[6];
        val += data[((y + 1) * w + x) * 4 + c] * kernel[7];
        val += data[((y + 1) * w + (x + 1)) * 4 + c] * kernel[8];
        out[idx + c] = val;
      }
      out[idx + 3] = data[idx + 3];
    }
  }
  
  for (let i = 0; i < data.length; i += 4) {
    if (out[i] === 0 && out[i+1] === 0 && out[i+2] === 0) {
      out[i] = data[i]; out[i+1] = data[i+1]; out[i+2] = data[i+2]; out[i+3] = data[i+3];
    }
  }
  
  return new ImageData(out, w, h);
}

function rotateCanvas(canvas: HTMLCanvasElement, angle: number) {
  const rotated = document.createElement("canvas");
  const ctx = rotated.getContext("2d")!;
  
  if (angle === 90 || angle === 270) {
    rotated.width = canvas.height;
    rotated.height = canvas.width;
  } else {
    rotated.width = canvas.width;
    rotated.height = canvas.height;
  }
  
  ctx.translate(rotated.width / 2, rotated.height / 2);
  ctx.rotate(angle * Math.PI / 180);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  
  return { canvas: rotated };
}

function upscaleCanvas(canvas: HTMLCanvasElement, scale: number) {
  const upscaled = document.createElement("canvas");
  upscaled.width = canvas.width * scale;
  upscaled.height = canvas.height * scale;
  const ctx = upscaled.getContext("2d")!;
  ctx.drawImage(canvas, 0, 0, upscaled.width, upscaled.height);
  return { canvas: upscaled };
}

function mapRotationBox(box: any, angle: number, w: number, h: number) {
  let { x, y, width, height } = box;
  if (angle === 90) {
    return { x: y, y: w - x - width, width: height, height: width };
  } else if (angle === 180) {
    return { x: w - x - width, y: h - y - height, width, height };
  } else if (angle === 270) {
    return { x: h - y - height, y: x, width: height, height: width };
  }
  return box;
}

function iou(a: any, b: any) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const aArea = a.width * a.height;
  const bArea = b.width * b.height;
  return intersection / (aArea + bArea - intersection);
}

function deduplicate(detections: FaceDetection[], iouThreshold: number): FaceDetection[] {
  const result: FaceDetection[] = [];
  for (const det of detections) {
    let duplicate = false;
    for (const existing of result) {
      if (iou(det.box, existing.box) > iouThreshold) {
        duplicate = true;
        break;
      }
    }
    if (!duplicate) result.push(det);
  }
  return result;
}

function preprocessImage(img: HTMLImageElement) {
  const ow = img.naturalWidth || img.width;
  const oh = img.naturalHeight || img.height;
  
  const maxDim = 1024;
  const scale = Math.min(1, maxDim / Math.max(ow, oh));
  const w = Math.round(ow * scale);
  const h = Math.round(oh * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  
  ctx.filter = "contrast(1.1) brightness(1.05)";
  ctx.drawImage(img, 0, 0, w, h);
  ctx.filter = "none";

  const imageData = ctx.getImageData(0, 0, w, h);
  const sharpened = applyUnsharpMask(imageData, w, h);
  ctx.putImageData(sharpened, 0, 0);

  return { canvas, scaleX: ow / w, scaleY: oh / h };
}

export async function detectFaces(
  imageSource: Blob | HTMLImageElement
): Promise<FaceDetection[]> {
  await loadFaceDetectionModel();
  if (!faceDetector || !faceLandmarker) return [];

  const startTime = performance.now();
  try {
    const img = await toHTMLImage(imageSource);
    
    // Preprocess
    const { canvas, scaleX, scaleY } = preprocessImage(img);
    const preprocessingMs = performance.now() - startTime;

    const runPass = async (c: HTMLCanvasElement, sx: number, sy: number, angle: any, isPyramid: boolean) => {
      const [detResult, lmResult] = await Promise.all([
        Promise.resolve(faceDetector!.detect(c)),
        Promise.resolve(faceLandmarker!.detect(c)),
      ]);
      return buildDetections(img, c, detResult, lmResult, sx, sy, angle, isPyramid, preprocessingMs);
    };

    let detections = await runPass(canvas, scaleX, scaleY, 0, false);

    // Multi-angle retry
    if (detections.length === 0) {
      console.log("[FaceDetection] 0 faces, retrying with multi-angle passes...");
      const angles = [90, 180, 270];
      const allPasses: FaceDetection[] = [];
      
      for (const angle of angles) {
        const rotated = rotateCanvas(canvas, angle);
        const passDetections = await runPass(rotated.canvas, scaleX, scaleY, angle as any, false);
        
        const mapped = passDetections.map(d => {
            d.box = mapRotationBox(d.box, angle, canvas.width, canvas.height);
            return d;
        });
        allPasses.push(...mapped);
      }
      detections = deduplicate(allPasses, 0.4);
    }

    // Scale Pyramid for large images
    if (img.width > 800 || img.height > 800) {
      const upscaled = upscaleCanvas(canvas, 2.0);
      const pyramidDetections = await runPass(upscaled.canvas, scaleX / 2.0, scaleY / 2.0, 0, true);
      detections = deduplicate([...detections, ...pyramidDetections], 0.4);
    }

    // Filter Confidence
    const imgArea = img.width * img.height;
    detections = detections.filter(det => {
      const area = det.box.width * det.box.height;
      if (area / imgArea < 0.02) return false;

      if (det.landmarks && det.landmarks.positions) {
        const zVarCount = det.landmarks.positions.filter(p => Math.abs(p.z || 0) > 0.001).length;
        if (zVarCount < 400) return false;
      }
      return true;
    });

    return detections.sort((a, b) => (b.score || 0) - (a.score || 0));

  } catch (err) {
    console.error("[FaceDetection] Error:", err);
    return [];
  }
}

// ─── Build Detections ─────────────────────────────────────────────────────────

function buildDetections(
  originalImg: HTMLImageElement,
  canvas: HTMLCanvasElement,
  detResult: FaceDetectorResult,
  lmResult: FaceLandmarkerResult,
  scaleX: number,
  scaleY: number,
  rotationApplied: 0 | 90 | 180 | 270 = 0,
  scalePyramidPass: boolean = false,
  preprocessingMs: number = 0
): FaceDetection[] {
  const W = canvas.width;
  const H = canvas.height;
  const faces: FaceDetection[] = [];

  for (let i = 0; i < detResult.detections.length; i++) {
    const det = detResult.detections[i];
    const bbox = det.boundingBox;
    if (!bbox) continue;

    const box = {
      x: bbox.originX * scaleX,
      y: bbox.originY * scaleY,
      width: bbox.width * scaleX,
      height: bbox.height * scaleY,
    };

    const lm478 = lmResult.faceLandmarks[i];
    let landmarks478: { positions: { x: number; y: number; z?: number }[] } | undefined;
    let descriptor: Float32Array = new Float32Array(128);
    let likelyFalsePositive = false;

    if (lm478) {
      const positions = lm478.map((pt) => ({
        x: pt.x * W * scaleX,
        y: pt.y * H * scaleY,
        z: pt.z,
      }));
      landmarks478 = { positions };
      descriptor = landmarksToDescriptor(lm478, W, H);

      const leftEye = lm478[33];
      const rightEye = lm478[263];
      const noseTip = lm478[4];
      if (leftEye && rightEye && noseTip) {
        const yDiff = Math.abs(leftEye.y - rightEye.y);
        const eyeHorizontal = yDiff < 0.05;
        const noseBetween = noseTip.x > Math.min(leftEye.x, rightEye.x) && noseTip.x < Math.max(leftEye.x, rightEye.x);
        if (!eyeHorizontal && !noseBetween) likelyFalsePositive = true;
      }
    }

    const { skinTone, quality } = analyzeRegion(originalImg, box, landmarks478 as any);

    faces.push({
      id: `face-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      box,
      descriptor,
      landmarks: landmarks478,
      score: det.categories[0]?.score ?? 0,
      quality,
      skinTone,
      rotationApplied,
      scalePyramidPass,
      likelyFalsePositive,
      preprocessingMs,
    });
  }

  console.log(`[FaceDetection] Found ${faces.length} faces (angle=${rotationApplied}, pyramid=${scalePyramidPass})`);
  return faces;
}

// ─── Landmark → 128-dim Descriptor ───────────────────────────────────────────
/**
 * Converts 478 MediaPipe landmarks into a 128-dim normalized geometry descriptor.
 * This is NOT a face recognition embedding (for that you'd need FaceNet/ArcFace),
 * but it's consistent across photos of the same person and powers clustering.
 *
 * Key landmark indices (MediaPipe 478-point):
 * 33=leftEye, 263=rightEye, 1=nose, 61=leftMouth, 291=rightMouth, 10=forehead
 */
function landmarksToDescriptor(
  lms: { x: number; y: number; z: number }[],
  W: number,
  H: number
): Float32Array {
  const get = (i: number) => ({ x: lms[i].x * W, y: lms[i].y * H });

  const leftEye = get(33);
  const rightEye = get(263);
  const nose = get(1);
  const leftMouth = get(61);
  const rightMouth = get(291);
  const chin = get(152);
  const forehead = get(10);

  // Normalize by inter-ocular distance
  const iod = dist(leftEye, rightEye) || 1;
  const mid = midpoint(leftEye, rightEye);

  const normalize = (pt: { x: number; y: number }) => [
    (pt.x - mid.x) / iod,
    (pt.y - mid.y) / iod,
  ];

  // 128 values: geometric ratios between landmark pairs
  const desc = new Float32Array(128);
  const keyPoints = [
    leftEye, rightEye, nose, leftMouth, rightMouth, chin, forehead,
    get(70), get(300), get(4), get(13), get(14), // extras: brow, tip, lips
    get(362), get(133), get(168), get(197), // eye corners, nose bridge
  ];

  let idx = 0;
  for (const p of keyPoints) {
    const [nx, ny] = normalize(p);
    desc[idx++] = nx;
    desc[idx++] = ny;
    if (idx >= 128) break;
  }

  // Fill remaining slots with pairwise ratios
  for (let i = 0; i < keyPoints.length && idx < 128; i++) {
    for (let j = i + 1; j < keyPoints.length && idx < 128; j++) {
      desc[idx++] = dist(keyPoints[i], keyPoints[j]) / iod;
    }
  }

  return desc;
}

// ─── Quality & Skin Tone ──────────────────────────────────────────────────────

function analyzeRegion(
  img: HTMLImageElement,
  box: { x: number; y: number; width: number; height: number },
  landmarks?: { positions: { x: number; y: number }[] }
): { skinTone: { r: number; g: number; b: number }; quality: number } {
  const fallback = { skinTone: { r: 128, g: 100, b: 90 }, quality: 0.5 };
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) return fallback;

    ctx.drawImage(img, box.x, box.y, box.width, box.height, 0, 0, 128, 128);
    const { data } = ctx.getImageData(0, 0, 128, 128);

    // Skin tone: sample center region
    let r = 0, g = 0, b = 0, count = 0;
    for (let py = 35; py < 90; py++) {
      for (let px = 35; px < 90; px++) {
        const i = (py * 128 + px) * 4;
        r += data[i]; g += data[i + 1]; b += data[i + 2];
        count++;
      }
    }
    const skinTone = {
      r: r / count,
      g: g / count,
      b: b / count,
    };

    // Brightness
    const lum = 0.299 * skinTone.r + 0.587 * skinTone.g + 0.114 * skinTone.b;
    const brightnessScore = lum >= 60 && lum <= 200
      ? 1.0
      : 1.0 - Math.abs(lum - 130) / 130;

    // Sharpness (Laplacian approx via horizontal gradient)
    let edgeSum = 0;
    for (let i = 0; i < data.length - 4; i += 4) {
      edgeSum += Math.abs(data[i] - data[i + 4]);
    }
    const sharpnessScore = Math.min((edgeSum / (128 * 128)) / 15, 1.0);

    // Frontality from landmarks
    let frontalityScore = 0.7;
    let symmetryScore = 0.75;
    if (landmarks) {
      const pos = landmarks.positions;
      // Use 68-pt equivalent indices mapped from 478 (rough mapping)
      const lE = pos[33] ?? pos[0];
      const rE = pos[263] ?? pos[16];
      const nse = pos[1] ?? pos[8];
      if (lE && rE && nse) {
        const eyeD = dist(lE, rE) || 1;
        const midX = (lE.x + rE.x) / 2;
        frontalityScore = 1 - Math.min(Math.abs(nse.x - midX) / (eyeD * 0.5), 1);
        const ld = dist(lE, nse), rd = dist(rE, nse);
        symmetryScore = 1 - Math.abs(ld - rd) / Math.max(ld, rd, 1);
      }
    }

    const resolutionScore = Math.min(box.width / 160, 1.0);
    const quality =
      sharpnessScore * 0.30 +
      brightnessScore * 0.20 +
      frontalityScore * 0.25 +
      resolutionScore * 0.15 +
      symmetryScore * 0.10;

    return { skinTone, quality };
  } catch {
    return fallback;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function toHTMLImage(src: Blob | HTMLImageElement): Promise<HTMLImageElement> {
  if (src instanceof HTMLImageElement) return src;
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(src);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

function downscale(
  img: HTMLImageElement,
  maxDim: number
): { canvas: HTMLCanvasElement; scaleX: number; scaleY: number } {
  const ow = img.naturalWidth || img.width;
  const oh = img.naturalHeight || img.height;
  const scale = Math.min(1, maxDim / Math.max(ow, oh));
  const w = Math.round(ow * scale);
  const h = Math.round(oh * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);

  return { canvas, scaleX: ow / w, scaleY: oh / h };
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// ─── Exports (drop-in replacements for face-api equivalents) ──────────────────

export function faceDistance(d1: Float32Array, d2: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < d1.length; i++) sum += (d1[i] - d2[i]) ** 2;
  return Math.sqrt(sum);
}

export function facesMatch(
  d1: Float32Array,
  d2: Float32Array,
  threshold = 0.55
): boolean {
  return faceDistance(d1, d2) < threshold;
}

export async function extractFaceThumbnail(
  imageSource: Blob,
  box: { x: number; y: number; width: number; height: number },
  padding = 0.3
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageSource);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const px = box.width * padding;
      const py = box.height * padding;
      const x = Math.max(0, box.x - px);
      const y = Math.max(0, box.y - py);
      const w = Math.min(img.width - x, box.width + px * 2);
      const h = Math.min(img.height - y, box.height + py * 2);

      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      canvas.getContext("2d")!.drawImage(img, x, y, w, h, 0, 0, 128, 128);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Thumbnail failed"))),
        "image/jpeg",
        0.88
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}
