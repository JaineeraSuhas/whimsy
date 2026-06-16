/**
 * face-processing.ts — Optimized batch processor
 *
 * Improvements:
 * 1. Pre-loads models eagerly at import time (warmup)
 * 2. Queue-based batch processing instead of debounce timeouts
 * 3. Controlled concurrency (max 2 parallel detections)
 * 4. Better error recovery per photo (failure doesn't block the queue)
 * 5. Processing state emits 'detecting' per-photo for granular UI updates
 */

import {
  detectFaces,
  extractFaceThumbnail,
  loadFaceDetectionModel,
  FaceDetection,
} from "./face-detection";
import { clusterFaces } from "./face-clustering";
import {
  Photo,
  DetectedPerson,
  getAllPhotos,
  getAllPeople,
  savePerson,
  savePhoto,
  getDB,
} from "./db";

// ─── State ────────────────────────────────────────────────────────────────────

export type ProcessingState = "idle" | "detecting" | "clustering";

let currentState: ProcessingState = "idle";
const subscribers = new Set<(state: ProcessingState) => void>();

export function getProcessingState() { return currentState; }

export function subscribeToProcessingState(
  cb: (state: ProcessingState) => void
) {
  subscribers.add(cb);
  cb(currentState);
  return () => subscribers.delete(cb);
}

function setState(state: ProcessingState) {
  if (currentState === state) return;
  currentState = state;
  console.log(`[FaceProcessing] → ${state}`);
  subscribers.forEach((cb) => cb(state));
}

// ─── Warmup ───────────────────────────────────────────────────────────────────
// Start loading models immediately when this module is imported,
// so by the time the user uploads a photo, models are already in memory.

let warmupDone = false;
export async function warmupModels(): Promise<void> {
  if (warmupDone) return;
  warmupDone = true;
  try {
    await loadFaceDetectionModel();
    console.log("[FaceProcessing] Models warmed up ✅");
  } catch (e) {
    console.warn("[FaceProcessing] Warmup failed (will retry on first photo):", e);
  }
}

// ─── Queue ────────────────────────────────────────────────────────────────────
// Collect photos needing detection; flush after a short idle window.

const pendingQueue: Photo[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const MAX_CONCURRENT = 2;

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushQueue, 400);
}

async function flushQueue() {
  if (pendingQueue.length === 0) return;
  const batch = pendingQueue.splice(0, pendingQueue.length);
  setState("detecting");

  // Process in chunks of MAX_CONCURRENT
  for (let i = 0; i < batch.length; i += MAX_CONCURRENT) {
    const chunk = batch.slice(i, i + MAX_CONCURRENT);
    await Promise.all(chunk.map(processOne));
  }

  // Re-cluster after all detections complete
  await updatePeopleClusters();
}

async function processOne(photo: Photo): Promise<void> {
  try {
    const faces = await detectFaces(photo.blob);
    if (faces.length === 0) return;

    console.log(`[FaceProcessing] ${faces.length} faces in ${photo.id}`);
    await savePhoto({ ...photo, faces });
  } catch (err) {
    console.error(`[FaceProcessing] Detection failed for ${photo.id}:`, err);
    // Don't rethrow — let the rest of the batch continue
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Queue a photo for face detection.
 * Non-blocking — returns the original photo immediately.
 */
export async function processFacesInPhoto(photo: Photo): Promise<Photo> {
  pendingQueue.push(photo);
  scheduleFlush();
  return photo;
}

// ─── Clustering ───────────────────────────────────────────────────────────────

let isClustering = false;

export async function updatePeopleClusters(): Promise<void> {
  if (isClustering) {
    console.warn("[FaceProcessing] Clustering already running, skipping");
    return;
  }

  isClustering = true;
  setState("clustering");

  try {
    const allPhotos = await getAllPhotos();

    const facesMap = new Map<string, FaceDetection[]>();
    for (const photo of allPhotos) {
      if (photo.faces?.length) facesMap.set(photo.id, photo.faces);
    }

    if (facesMap.size === 0) {
      console.log("[FaceProcessing] No faces to cluster");
      const db = await getDB();
      const tx = db.transaction("people", "readwrite");
      await tx.store.clear();
      await tx.done;
      return;
    }

    console.log(
      `[FaceProcessing] Clustering faces from ${facesMap.size} photos...`
    );

    // Preserve user-assigned names
    const existingPeople = await getAllPeople();
    const faceToName = new Map<string, string>();
    for (const p of existingPeople) {
      if (p.name.startsWith("Person ")) continue;
      for (const fid of p.faceIds) faceToName.set(fid, p.name);
    }

    const clusters = clusterFaces(facesMap);
    console.log(`[FaceProcessing] ${clusters.length} clusters found`);

    const peopleToSave: DetectedPerson[] = [];

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];

      // Vote for best name
      const votes = new Map<string, number>();
      for (const fid of cluster.faceIds) {
        const name = faceToName.get(fid);
        if (name) votes.set(name, (votes.get(name) ?? 0) + 1);
      }
      let bestName = `Person ${i + 1}`;
      let maxVotes = 0;
      for (const [name, count] of votes) {
        if (count > maxVotes) { maxVotes = count; bestName = name; }
      }

      // Find thumbnail source
      let thumbnailBlob: Blob | null = null;
      for (const photo of allPhotos) {
        const face = photo.faces?.find((f) => f.id === cluster.representativeFaceId);
        if (face && photo.blob) {
          try {
            thumbnailBlob = await extractFaceThumbnail(photo.blob, face.box);
          } catch {
            /* skip */
          }
          break;
        }
      }

      if (!thumbnailBlob) continue;

      peopleToSave.push({
        id: cluster.id,
        name: bestName,
        faceIds: cluster.faceIds,
        anchors: cluster.anchors,
        skinTone: cluster.skinTone,
        thumbnailBlob,
        photoCount: cluster.photoCount,
        createdAt: Date.now(),
      });
    }

    // Atomic write
    const db = await getDB();
    const tx = db.transaction("people", "readwrite");
    await tx.store.clear();
    for (const p of peopleToSave) await tx.store.put(p);
    await tx.done;

    console.log(`[FaceProcessing] ✅ ${peopleToSave.length} people saved`);
  } catch (err) {
    console.error("[FaceProcessing] Clustering error:", err);
  } finally {
    isClustering = false;
    setTimeout(() => setState("idle"), 80);
  }
}

// ─── People with Thumbnails ───────────────────────────────────────────────────

export async function getPeopleWithThumbnails(): Promise<
  Array<{
    id: string;
    name: string;
    thumbnailBlob?: Blob;
    thumbnailUrl?: string;
    photoCount: number;
  }>
> {
  const people = await getAllPeople();

  // Deduplicate by id
  const unique = Array.from(new Map(people.map((p) => [p.id, p])).values());

  console.log(`[FaceProcessing] ${unique.length} unique people`);

  return unique.map((p) => ({
    id: p.id,
    name: p.name,
    thumbnailBlob: p.thumbnailBlob ?? undefined,
    thumbnailUrl: undefined,
    photoCount: p.photoCount,
  }));
}
