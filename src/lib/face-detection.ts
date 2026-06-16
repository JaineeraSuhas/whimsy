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
  landmarks?: { positions: { x: number; y: number }[] };
  score?: number;
  quality?: number;
  skinTone?: { r: number; g: number; b: number };
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
        minDetectionConfidence: 0.45,
        minSuppressionThreshold: 0.3,
      }),
      FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        numFaces: 20,
        minFaceDetectionConfidence: 0.45,
        minFacePresenceConfidence: 0.45,
        minTrackingConfidence: 0.45,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      }),
    ]);

    console.log("[FaceDetection] Models ready ✅");
  })();

  return modelLoadPromise;
}

// ─── Core Detection ───────────────────────────────────────────────────────────

export async function detectFaces(
  imageSource: Blob | HTMLImageElement
): Promise<FaceDetection[]> {
  await loadFaceDetectionModel();
  if (!faceDetector || !faceLandmarker) return [];

  try {
    const img = await toHTMLImage(imageSource);
    const { canvas, scaleX, scaleY } = downscale(img, 960);

    // Run both models in parallel
    const [detResult, lmResult] = await Promise.all([
      Promise.resolve(faceDetector.detect(canvas)),
      Promise.resolve(faceLandmarker.detect(canvas)),
    ]);

    return buildDetections(img, canvas, detResult, lmResult, scaleX, scaleY);
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
  scaleY: number
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

    // Map MediaPipe 478-point landmarks to 68-point-compatible format
    const lm478 = lmResult.faceLandmarks[i];
    let landmarks478: { positions: { x: number; y: number }[] } | undefined;
    let descriptor: Float32Array = new Float32Array(128);

    if (lm478) {
      const positions = lm478.map((pt) => ({
        x: pt.x * W * scaleX,
        y: pt.y * H * scaleY,
      }));
      landmarks478 = { positions };
      descriptor = landmarksToDescriptor(lm478, W, H);
    }

    const { skinTone, quality } = analyzeRegion(originalImg, box, landmarks478);

    faces.push({
      id: `face-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      box,
      descriptor,
      landmarks: landmarks478,
      score: det.categories[0]?.score ?? 0,
      quality,
      skinTone,
    });
  }

  console.log(`[FaceDetection] Found ${faces.length} faces`);
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
