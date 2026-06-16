/**
 * face-detection.ts — MediaPipe Tasks Vision (WASM-accelerated)
 *
 * FIXES vs previous version:
 * ✅ Removed FaceDetector entirely — was causing index-mismatch with FaceLandmarker.
 *    We now derive bounding boxes from the 478 landmarks directly (always consistent).
 * ✅ z-variance filter removed — threshold 0.001 was incorrectly killing valid faces
 *    because MediaPipe normalised z values are sub-millimetre floats.
 * ✅ Multi-angle box remapping fixed — was double-scaling coordinates.
 * ✅ Pyramid pass scale fixed — was dividing instead of multiplying scaleX/Y.
 * ✅ preprocessImage + downscale unified into one pipeline (no duplicate logic).
 * ✅ Liveness check made lenient (+/- 0.05 tolerance) to reduce false-positives.
 */

import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FaceDetection {
  id: string;
  box: { x: number; y: number; width: number; height: number };
  descriptor: Float32Array;
  landmarks?: { positions: { x: number; y: number; z?: number }[] };
  score?: number;
  quality?: number;
  skinTone?: { r: number; g: number; b: number };
  rotationApplied?: 0 | 90 | 180 | 270;
  scalePyramidPass?: boolean;
  likelyFalsePositive?: boolean;
  preprocessingMs?: number;
}

type Box = { x: number; y: number; width: number; height: number };

// ─── Singleton ────────────────────────────────────────────────────────────────

let faceLandmarker: FaceLandmarker | null = null;
let modelLoadPromise: Promise<void> | null = null;

const MEDIAPIPE_WASM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float32/1/face_landmarker.task";

export async function loadFaceDetectionModel(): Promise<void> {
  if (faceLandmarker) return;
  if (modelLoadPromise) return modelLoadPromise;

  modelLoadPromise = (async () => {
    console.log("[FaceDetection] Loading MediaPipe FaceLandmarker (float32)…");
    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);

    const opts = (delegate: "GPU" | "CPU") => ({
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: "IMAGE" as const,
      numFaces: 10,
      minFaceDetectionConfidence: 0.35,
      minFacePresenceConfidence: 0.35,
      minTrackingConfidence: 0.35,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });

    try {
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, opts("GPU"));
    } catch {
      console.warn("[FaceDetection] GPU unavailable, using CPU");
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, opts("CPU"));
    }

    console.log("[FaceDetection] Model ready ✅");
  })();

  return modelLoadPromise;
}

// ─── Preprocessing ────────────────────────────────────────────────────────────

function preprocessToCanvas(img: HTMLImageElement, maxDim = 1024): HTMLCanvasElement {
  const ow = img.naturalWidth  || img.width;
  const oh = img.naturalHeight || img.height;
  const scale = Math.min(1, maxDim / Math.max(ow, oh));
  const w = Math.round(ow * scale);
  const h = Math.round(oh * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  ctx.filter = "contrast(1.12) brightness(1.06)";
  ctx.drawImage(img, 0, 0, w, h);
  ctx.filter = "none";

  const id = ctx.getImageData(0, 0, w, h);
  ctx.putImageData(sharpen(id, w, h), 0, 0);

  return canvas;
}

function sharpen(imageData: ImageData, w: number, h: number): ImageData {
  const src = imageData.data;
  const out = new Uint8ClampedArray(src.length);
  for (let i = 3; i < src.length; i += 4) out[i] = src[i]; // copy alpha

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const c = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const v =
          5 * src[c + ch] -
          src[((y - 1) * w + x    ) * 4 + ch] -
          src[((y + 1) * w + x    ) * 4 + ch] -
          src[(     y  * w + x - 1) * 4 + ch] -
          src[(     y  * w + x + 1) * 4 + ch];
        out[c + ch] = Math.max(0, Math.min(255, v));
      }
    }
  }
  // border pixels passthrough
  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      const i = (y * w + x) * 4;
      out[i] = src[i]; out[i+1] = src[i+1]; out[i+2] = src[i+2];
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) {
      const i = (y * w + x) * 4;
      out[i] = src[i]; out[i+1] = src[i+1]; out[i+2] = src[i+2];
    }
  }
  return new ImageData(out, w, h);
}

// ─── Canvas utils ─────────────────────────────────────────────────────────────

function rotateCanvas(src: HTMLCanvasElement, angle: 90 | 180 | 270): HTMLCanvasElement {
  const swap = angle === 90 || angle === 270;
  const dst  = document.createElement("canvas");
  dst.width  = swap ? src.height : src.width;
  dst.height = swap ? src.width  : src.height;
  const ctx  = dst.getContext("2d")!;
  ctx.translate(dst.width / 2, dst.height / 2);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return dst;
}

function upscaleCanvas(src: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  const dst = document.createElement("canvas");
  dst.width  = Math.round(src.width  * factor);
  dst.height = Math.round(src.height * factor);
  dst.getContext("2d")!.drawImage(src, 0, 0, dst.width, dst.height);
  return dst;
}

// ─── Box helpers ──────────────────────────────────────────────────────────────

/**
 * Rotate a normalised box back to 0° space.
 * All coords are 0-1 fractions.
 */
function unmapRotatedBox(b: Box, angle: 0 | 90 | 180 | 270): Box {
  if (angle === 0)   return b;
  if (angle === 90)  return { x: b.y,           y: 1 - b.x - b.width,  width: b.height, height: b.width  };
  if (angle === 180) return { x: 1 - b.x - b.width, y: 1 - b.y - b.height, width: b.width,  height: b.height };
  /* 270 */          return { x: 1 - b.y - b.height, y: b.x,             width: b.height, height: b.width  };
}

function iou(a: Box, b: Box): number {
  const ix1 = Math.max(a.x, b.x), iy1 = Math.max(a.y, b.y);
  const ix2 = Math.min(a.x + a.width, b.x + b.width);
  const iy2 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
  if (inter === 0) return 0;
  return inter / (a.width * a.height + b.width * b.height - inter);
}

function deduplicateByIou(faces: FaceDetection[], threshold = 0.4): FaceDetection[] {
  const result: FaceDetection[] = [];
  for (const face of faces) {
    // Normalise to 0-1 for IoU comparison (boxes are in pixel space here)
    // We compare raw pixel boxes — consistent since all come from same original image
    const dup = result.some((r) => iou(r.box, face.box) > threshold);
    if (!dup) result.push(face);
  }
  return result;
}

// ─── Landmark → bbox ─────────────────────────────────────────────────────────

/** Normalised (0-1) bounding box from landmark extremes + 6% padding */
function landmarksToBbox(lms: { x: number; y: number }[]): Box {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const { x, y } of lms) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const padX = (maxX - minX) * 0.06;
  const padY = (maxY - minY) * 0.06;
  return {
    x:      Math.max(0, minX - padX),
    y:      Math.max(0, minY - padY),
    width:  Math.min(1 - Math.max(0, minX - padX), maxX - minX + padX * 2),
    height: Math.min(1 - Math.max(0, minY - padY), maxY - minY + padY * 2),
  };
}

// ─── 128-dim descriptor ───────────────────────────────────────────────────────

const KEY_INDICES = [
  33, 263,      // eye centres
  1,  4,        // nose bridge + tip
  61, 291,      // mouth corners
  152, 10,      // chin, forehead
  70, 300,      // brow peaks
  362, 133,     // outer eye corners
  168, 197,     // nose bridge mid, philtrum
  13, 14,       // upper/lower lip mid
  234, 454,     // cheek extremes
  50, 280,      // mid-cheek
];

function landmarksToDescriptor(lms: { x: number; y: number; z: number }[]): Float32Array {
  const lE = lms[33], rE = lms[263];
  const iod = Math.hypot(rE.x - lE.x, rE.y - lE.y) || 1;
  const cx = (lE.x + rE.x) / 2, cy = (lE.y + rE.y) / 2;

  const pts = KEY_INDICES.map((i) => ({
    x: (lms[i].x - cx) / iod,
    y: (lms[i].y - cy) / iod,
    z:  lms[i].z        / iod,
  }));

  const desc = new Float32Array(128);
  let idx = 0;

  // Normalised coordinates
  for (const p of pts) {
    if (idx >= 126) break;
    desc[idx++] = p.x;
    desc[idx++] = p.y;
  }

  // Pairwise distances until 128 slots filled
  outer: for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (idx >= 128) break outer;
      desc[idx++] = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
    }
  }

  return desc;
}

// ─── Liveness hint ────────────────────────────────────────────────────────────

function isLikelyFalsePositive(lms: { x: number; y: number }[]): boolean {
  const lE = lms[33], rE = lms[263], nose = lms[4];
  if (!lE || !rE || !nose) return false;

  const yDiff = Math.abs(lE.y - rE.y);
  const eyesHorizontal = yDiff < 0.08; // lenient for tilted heads

  const midX = (lE.x + rE.x) / 2;
  const halfEyeSpan = Math.abs(rE.x - lE.x) / 2 + 0.05;
  const noseBetween = nose.x > midX - halfEyeSpan && nose.x < midX + halfEyeSpan;

  return !eyesHorizontal && !noseBetween;
}

// ─── Quality + skin tone ──────────────────────────────────────────────────────

function analyzeRegion(
  img: HTMLImageElement,
  normBbox: Box
): { skinTone: { r: number; g: number; b: number }; quality: number } {
  const fallback = { skinTone: { r: 128, g: 100, b: 90 }, quality: 0.5 };
  try {
    const ow = img.naturalWidth || img.width;
    const oh = img.naturalHeight || img.height;
    const sx = normBbox.x * ow, sy = normBbox.y * oh;
    const sw = normBbox.width * ow, sh = normBbox.height * oh;
    if (sw < 2 || sh < 2) return fallback;

    const S = 80;
    const c = document.createElement("canvas");
    c.width = S; c.height = S;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, S, S);
    const { data } = ctx.getImageData(0, 0, S, S);

    let r = 0, g = 0, b = 0, n = 0;
    const lo = Math.floor(S * 0.28), hi = Math.floor(S * 0.72);
    for (let py = lo; py < hi; py++) {
      for (let px = lo; px < hi; px++) {
        const i = (py * S + px) * 4;
        r += data[i]; g += data[i+1]; b += data[i+2]; n++;
      }
    }
    const skinTone = { r: r/n, g: g/n, b: b/n };

    const lum = 0.299 * skinTone.r + 0.587 * skinTone.g + 0.114 * skinTone.b;
    const brightnessScore = lum >= 50 && lum <= 210
      ? 1.0 : Math.max(0, 1 - Math.abs(lum - 130) / 130);

    let edgeSum = 0;
    for (let i = 0; i < data.length - 4; i += 4) edgeSum += Math.abs(data[i] - data[i+4]);
    const sharpnessScore = Math.min((edgeSum / (S * S)) / 12, 1.0);

    const resolutionScore = Math.min(sw / 100, 1.0);
    const quality = sharpnessScore * 0.35 + brightnessScore * 0.25 + resolutionScore * 0.25 + 0.15;
    return { skinTone, quality };
  } catch {
    return fallback;
  }
}

// ─── Core pass ────────────────────────────────────────────────────────────────

function runLandmarker(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  angle: 0 | 90 | 180 | 270,
  isPyramid: boolean,
  preprocessingMs: number
): FaceDetection[] {
  const result: FaceLandmarkerResult = faceLandmarker!.detect(canvas);
  const ow = img.naturalWidth || img.width;
  const oh = img.naturalHeight || img.height;

  return result.faceLandmarks.map((lms) => {
    // 1. Normalised bbox in rotated-canvas space
    const normBboxRotated = landmarksToBbox(lms);

    // 2. Unmap back to 0° normalised space
    const normBbox = unmapRotatedBox(normBboxRotated, angle);

    // 3. Convert to original pixel space
    const box: Box = {
      x:      normBbox.x      * ow,
      y:      normBbox.y      * oh,
      width:  normBbox.width  * ow,
      height: normBbox.height * oh,
    };

    const descriptor = landmarksToDescriptor(lms);
    const likelyFalsePositive = isLikelyFalsePositive(lms);
    const { skinTone, quality } = analyzeRegion(img, normBbox);

    return {
      id: `face-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      box,
      descriptor,
      landmarks: {
        positions: lms.map((p) => ({ x: p.x * ow, y: p.y * oh, z: p.z })),
      },
      score:    1.0,
      quality,
      skinTone,
      rotationApplied:    angle,
      scalePyramidPass:   isPyramid,
      likelyFalsePositive,
      preprocessingMs,
    } satisfies FaceDetection;
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function detectFaces(imageSource: Blob | HTMLImageElement): Promise<FaceDetection[]> {
  await loadFaceDetectionModel();
  if (!faceLandmarker) return [];

  const t0 = performance.now();

  try {
    const img = await toHTMLImage(imageSource);
    const ow  = img.naturalWidth  || img.width;
    const oh  = img.naturalHeight || img.height;

    // 1. Preprocess
    const canvas = preprocessToCanvas(img, 1024);
    const preprocessingMs = performance.now() - t0;

    // 2. Primary pass (0°)
    let detections = runLandmarker(canvas, img, 0, false, preprocessingMs);
    console.log(`[FaceDetection] 0° → ${detections.length} faces`);

    // 3. Multi-angle retry (only when 0 faces found)
    if (detections.length === 0) {
      const rotationResults: FaceDetection[] = [];
      for (const angle of [90, 180, 270] as const) {
        const rotated = rotateCanvas(canvas, angle);
        const pass    = runLandmarker(rotated, img, angle, false, preprocessingMs);
        console.log(`[FaceDetection] ${angle}° → ${pass.length} faces`);
        rotationResults.push(...pass);
      }
      detections = deduplicateByIou(rotationResults, 0.4);
    }

    // 4. Scale pyramid (extra pass for wide images → catches small faces)
    if (ow > 800 || oh > 800) {
      const upscaled     = upscaleCanvas(canvas, 2);
      const pyramidFaces = runLandmarker(upscaled, img, 0, true, preprocessingMs);
      console.log(`[FaceDetection] pyramid → ${pyramidFaces.length} faces`);
      detections = deduplicateByIou([...detections, ...pyramidFaces], 0.4);
    }

    // 5. Area filter (< 1.5% of image area = noise)
    const imgArea = ow * oh;
    detections = detections.filter(
      (d) => (d.box.width * d.box.height) / imgArea >= 0.015
    );

    // 6. Sort best quality first
    detections.sort((a, b) => (b.quality ?? 0) - (a.quality ?? 0));

    console.log(
      `[FaceDetection] ✅ ${detections.length} faces in ${Math.round(performance.now() - t0)}ms`
    );
    return detections;

  } catch (err) {
    console.error("[FaceDetection] Error:", err);
    return [];
  }
}

export function faceDistance(d1: Float32Array, d2: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < d1.length; i++) sum += (d1[i] - d2[i]) ** 2;
  return Math.sqrt(sum);
}

export function facesMatch(d1: Float32Array, d2: Float32Array, threshold = 0.55): boolean {
  return faceDistance(d1, d2) < threshold;
}

export async function extractFaceThumbnail(imageSource: Blob, box: Box, padding = 0.3): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageSource);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const px = box.width  * padding;
      const py = box.height * padding;
      const x  = Math.max(0, box.x - px);
      const y  = Math.max(0, box.y - py);
      const w  = Math.min(img.width  - x, box.width  + px * 2);
      const h  = Math.min(img.height - y, box.height + py * 2);
      const c  = document.createElement("canvas");
      c.width = 128; c.height = 128;
      c.getContext("2d")!.drawImage(img, x, y, w, h, 0, 0, 128, 128);
      c.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Thumbnail failed")),
        "image/jpeg", 0.88
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

async function toHTMLImage(src: Blob | HTMLImageElement): Promise<HTMLImageElement> {
  if (src instanceof HTMLImageElement) return src;
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(src);
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}
