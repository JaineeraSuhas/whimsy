/**
 * face-types.ts — Single source of truth for all face-related types.
 *
 * The old version re-exported from both ai.ts and face-detection.ts,
 * causing duplicate identifier errors. ai.ts is now deleted.
 * Everything re-exports cleanly from face-detection.ts.
 */

export type {
  FaceDetection,
} from "./face-detection";

export type {
  FaceCluster,
} from "./face-clustering";

export type {
  Photo,
  PhotoMetadata,
  DetectedPerson,
} from "./db";

export type {
  ProcessingState,
} from "./face-processing";
