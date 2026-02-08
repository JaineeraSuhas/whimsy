import { FaceDetection, faceDistance } from './face-detection';

export interface FaceCluster {
    id: string;
    faceIds: string[];
    centroid: Float32Array;
    photoCount: number;
    representativeFaceId: string; // The face used for thumbnail
}

/**
 * Calculate similarity metrics between two faces
 * @returns weighted distance (lower is better, < 0.35 is good match)
 */
function calculateWeightedDistance(face1: FaceDetection, face2: FaceDetection): number {
    // 1. Embedding distance (70% weight)
    const dist = faceDistance(face1.descriptor, face2.descriptor);

    // 2. Face shape ratio distance (15% weight)
    const ratio1 = face1.box.height / face1.box.width;
    const ratio2 = face2.box.height / face2.box.width;
    const ratioDist = Math.abs(ratio1 - ratio2);

    // 3. Landmark proportions (15% weight)
    // Using relative distances (normalized) to be scale-invariant
    let landmarkDist = 0;
    if (face1.landmarks && face2.landmarks) {
        try {
            const getProp = (lm: any) => {
                const positions = lm.positions;
                // Eye centers (approximate from range)
                const leftEye = positions[36]; // roughly
                const rightEye = positions[45]; // roughly
                const nose = positions[30]; // nose tip
                const mouth = positions[62]; // mouth center

                const eyeDist = Math.sqrt(Math.pow(leftEye.x - rightEye.x, 2) + Math.pow(leftEye.y - rightEye.y, 2));
                const eyeToNose = Math.sqrt(Math.pow((leftEye.x + rightEye.x) / 2 - nose.x, 2) + Math.pow((leftEye.y + rightEye.y) / 2 - nose.y, 2));
                const eyeToMouth = Math.sqrt(Math.pow((leftEye.x + rightEye.x) / 2 - mouth.x, 2) + Math.pow((leftEye.y + rightEye.y) / 2 - mouth.y, 2));

                return {
                    prop1: eyeToNose / eyeDist,
                    prop2: eyeToMouth / eyeDist
                };
            };

            const p1 = getProp(face1.landmarks);
            const p2 = getProp(face2.landmarks);

            landmarkDist = (Math.abs(p1.prop1 - p2.prop1) + Math.abs(p2.prop2 - p2.prop2)) / 2;
        } catch (e) {
            landmarkDist = 0;
        }
    }

    // Weighted sum
    // normalize distances to ~0-1 range roughly
    const weightedDist = (dist * 0.70) + (Math.min(ratioDist, 1) * 0.15) + (Math.min(landmarkDist, 1) * 0.15);

    return weightedDist;
}

/**
 * Cluster faces using multi-factor similarity
 */
export function clusterFaces(
    allFaces: Map<string, FaceDetection[]>, // photoId -> faces
    distanceThreshold: number = 0.35 // Consistent with implementation plan
): FaceCluster[] {
    const facesWithPhotos: Array<{ face: FaceDetection; photoId: string }> = [];

    for (const [photoId, faces] of allFaces.entries()) {
        for (const face of faces) {
            facesWithPhotos.push({ face, photoId });
        }
    }

    if (facesWithPhotos.length === 0) return [];

    const clusters: FaceCluster[] = [];
    const assigned = new Set<string>();

    // Store best quality face for each cluster
    const clusterBestFaces = new Map<string, { face: FaceDetection; score: number }>();

    // Sort by detection score to process highest quality faces first (anchors)
    facesWithPhotos.sort((a, b) => (b.face.score || 0) - (a.face.score || 0));

    for (let i = 0; i < facesWithPhotos.length; i++) {
        const { face, photoId } = facesWithPhotos[i];
        if (assigned.has(face.id)) continue;

        let matchedCluster: FaceCluster | null = null;
        let minDistance = Infinity;

        for (const cluster of clusters) {
            const anchor = clusterBestFaces.get(cluster.id)?.face;
            if (!anchor) continue;

            // Use weighted distance comparing to high-quality anchor
            const distance = calculateWeightedDistance(face, anchor);

            if (distance < distanceThreshold && distance < minDistance) {
                matchedCluster = cluster;
                minDistance = distance;
            }
        }

        if (matchedCluster) {
            matchedCluster.faceIds.push(face.id);
            assigned.add(face.id);

            // Update representative face if this one is better quality
            const currentBest = clusterBestFaces.get(matchedCluster.id);
            if (!currentBest || (face.score || 0) > currentBest.score) {
                clusterBestFaces.set(matchedCluster.id, { face, score: face.score || 0 });
                matchedCluster.representativeFaceId = face.id;
            }

            // Update centroid
            const n = matchedCluster.faceIds.length;
            for (let j = 0; j < matchedCluster.centroid.length; j++) {
                matchedCluster.centroid[j] = (matchedCluster.centroid[j] * (n - 1) + face.descriptor[j]) / n;
            }

        } else {
            // Create new cluster
            const clusterId = `person-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const newCluster: FaceCluster = {
                id: clusterId,
                faceIds: [face.id],
                centroid: new Float32Array(face.descriptor),
                photoCount: 1,
                representativeFaceId: face.id,
            };

            assigned.add(face.id);
            clusters.push(newCluster);
            clusterBestFaces.set(clusterId, { face, score: face.score || 0 });
        }
    }

    // Update photo counts
    for (const cluster of clusters) {
        const photoIds = new Set<string>();
        for (const faceId of cluster.faceIds) {
            const fp = facesWithPhotos.find(f => f.face.id === faceId);
            if (fp) photoIds.add(fp.photoId);
        }
        cluster.photoCount = photoIds.size;
    }

    return clusters.sort((a, b) => b.photoCount - a.photoCount);
}

/**
 * Assign a single new face to a cluster
 */
export function assignFaceToCluster(
    face: FaceDetection,
    clusters: FaceCluster[],
    distanceThreshold: number = 0.35
): string | null {
    let bestMatch: { clusterId: string; distance: number } | null = null;

    for (const cluster of clusters) {
        // Find a representative high quality face for this cluster if possible, 
        // fall back to comparing with centroid (approximate)
        const distance = faceDistance(face.descriptor, cluster.centroid);

        if (distance < distanceThreshold) {
            if (!bestMatch || distance < bestMatch.distance) {
                bestMatch = { clusterId: cluster.id, distance };
            }
        }
    }

    return bestMatch?.clusterId || null;
}
