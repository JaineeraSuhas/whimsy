import { FaceDetection, faceDistance } from './face-detection';

export interface FaceCluster {
    id: string;
    faceIds: string[];
    anchors: Float32Array[]; // Multiple high-quality descriptors for different poses
    skinTone?: { r: number; g: number; b: number };
    photoCount: number;
    representativeFaceId: string;
}

/**
 * Calculate similarity between skin tones
 */
function skinToneSimilarity(t1?: { r: number, g: number, b: number }, t2?: { r: number, g: number, b: number }): number {
    if (!t1 || !t2) return 1.0;
    const dist = Math.sqrt(
        Math.pow(t1.r - t2.r, 2) +
        Math.pow(t1.g - t2.g, 2) +
        Math.pow(t1.b - t2.b, 2)
    );
    // Normalize: 441.67 is max color distance. Return distance where 0 is perfect match.
    return dist / 441.67;
}

/**
 * Calculate similarity metrics between two faces
 */
function calculateWeightedDistance(face1: FaceDetection, face2: FaceDetection): number {
    // 1. Embedding distance (60% weight - slightly reduced to favor unique markers)
    const dist = faceDistance(face1.descriptor, face2.descriptor);

    // 2. Face shape ratio distance (5% weight)
    const ratio1 = face1.box.height / face1.box.width;
    const ratio2 = face2.box.height / face2.box.width;
    const ratioDist = Math.abs(ratio1 - ratio2);

    // 3. Landmark proportions (20% weight - increased)
    let landmarkDist = 0;
    if (face1.landmarks && face2.landmarks) {
        try {
            const getProp = (lm: any) => {
                const pos = lm.positions;
                // Use multiple proportions for higher uniqueness
                const eyeDist = Math.sqrt(Math.pow(pos[36].x - pos[45].x, 2) + Math.pow(pos[36].y - pos[45].y, 2));
                const eyeToNose = Math.sqrt(Math.pow((pos[36].x + pos[45].x) / 2 - pos[30].x, 2) + Math.pow((pos[36].y + pos[45].y) / 2 - pos[30].y, 2));
                const noseToMouth = Math.sqrt(Math.pow(pos[30].x - pos[62].x, 2) + Math.pow(pos[30].y - pos[62].y, 2));
                return [eyeToNose / eyeDist, noseToMouth / eyeDist];
            };
            const p1 = getProp(face1.landmarks);
            const p2 = getProp(face2.landmarks);
            landmarkDist = (Math.abs(p1[0] - p2[0]) + Math.abs(p1[1] - p2[1])) / 2;
        } catch (e) { landmarkDist = 0; }
    }

    // 4. Skin tone similarity (15% weight - increased)
    const toneDist = skinToneSimilarity(face1.skinTone, face2.skinTone);

    return (dist * 0.60) + (Math.min(ratioDist, 1) * 0.05) + (Math.min(landmarkDist, 1) * 0.20) + (toneDist * 0.15);
}

/**
 * Cluster faces using multi-anchor person profiles
 */
export function clusterFaces(
    allFaces: Map<string, FaceDetection[]>,
    distanceThreshold: number = 0.25 // Even stricter threshold for zero duplicates
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

    // Process high-quality frontal faces first to build stable profiles
    facesWithPhotos.sort((a, b) => (b.face.score || 0) - (a.face.score || 0));

    for (const { face, photoId } of facesWithPhotos) {
        if (assigned.has(face.id)) continue;

        let matchedCluster: FaceCluster | null = null;
        let minDistance = Infinity;

        for (const cluster of clusters) {
            // Check against ALL anchors in the profile
            for (const anchorDescriptor of cluster.anchors) {
                // Approximate face for distance calculation
                const anchorFace = { ...face, descriptor: anchorDescriptor, skinTone: cluster.skinTone };
                const distance = calculateWeightedDistance(face, anchorFace);

                if (distance < distanceThreshold && distance < minDistance) {
                    matchedCluster = cluster;
                    minDistance = distance;
                }
            }
        }

        if (matchedCluster) {
            matchedCluster.faceIds.push(face.id);
            assigned.add(face.id);

            // If this face is quite different from existing anchors but matched, 
            // add it as a new anchor to the profile (pose learning)
            const existsNearAnchor = matchedCluster.anchors.some(a => faceDistance(face.descriptor, a) < 0.2);
            if (!existsNearAnchor && matchedCluster.anchors.length < 5) {
                matchedCluster.anchors.push(new Float32Array(face.descriptor));
            }
        } else {
            // New Person detected
            const clusterId = `person-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            clusters.push({
                id: clusterId,
                faceIds: [face.id],
                anchors: [new Float32Array(face.descriptor)],
                skinTone: face.skinTone,
                photoCount: 1,
                representativeFaceId: face.id,
            });
            assigned.add(face.id);
        }
    }

    // Post-process photo counts and representatives
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
    distanceThreshold: number = 0.25
): string | null {
    let bestMatch: { clusterId: string; distance: number } | null = null;

    for (const cluster of clusters) {
        // Compare with all anchors
        for (const anchor of cluster.anchors) {
            const dist = faceDistance(face.descriptor, anchor);
            if (dist < distanceThreshold) {
                if (!bestMatch || dist < bestMatch.distance) {
                    bestMatch = { clusterId: cluster.id, distance: dist };
                }
            }
        }
    }

    return bestMatch?.clusterId || null;
}
