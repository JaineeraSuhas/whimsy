
// This shim is needed because the explicit dependency @mediapipe/face_detection 
// does not export FaceDetection as an ESM module, causing build failures.
// Since we are using the 'tfjs' runtime, we don't actually use this class at runtime
// (unless we switch to 'mediapipe' runtime), but the static import in 
// @tensorflow-models/face-detection requires it to exist.

export class FaceDetection {
    constructor() {
        console.warn("FaceDetection (MediaPipe) shim used. If you see this and are using 'mediapipe' runtime, real detection will fail.");
    }
    setOptions() { }
    onResults() { }
    initialize() { return Promise.resolve(); }
    send() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
    reset() { }
}
