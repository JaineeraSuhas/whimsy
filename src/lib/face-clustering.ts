import { FaceDetection, faceDistance } from './face-detection';

export interface FaceCluster {
    id: string;
    faceIds: string[];
    centroid: Float32Array;
    photoCount: number;
    representativeFaceId: string; // The face used for thumbnail
}

/**
 * Cluster faces using Euclidean distance (face-api.js standard)
 * ENSURES ONE CLUSTER PER UNIQUE PERSON
 */
export function clusterFaces(
    allFaces: Map<string, FaceDetection[]>, // photoId -> faces
    distanceThreshold: number = 0.55 // Stricter threshold (lower = more strict)
): FaceCluster[] {
    // Collect all faces with their photo IDs
    const facesWithPhotos: Array<{ face: FaceDetection; photoId: string }> = [];

    for (const [photoId, faces] of allFaces.entries()) {
        for (const face of faces) {
            facesWithPhotos.push({ face, photoId });
        }
    }

    console.log(`[Clustering] Processing ${facesWithPhotos.length} total faces from ${allFaces.size} photos`);

    if (facesWithPhotos.length === 0) {
        return [];
    }

    // CRITICAL: Use greedy clustering to ensure no duplicates
    const clusters: FaceCluster[] = [];
    const assigned = new Set<string>();

    // Sort faces by photo ID to ensure consistent processing
    facesWithPhotos.sort((a, b) => a.photoId.localeCompare(b.photoId));

    for (let i = 0; i < facesWithPhotos.length; i++) {
        const { face, photoId } = facesWithPhotos[i];

        if (assigned.has(face.id)) {
            console.log(`[Clustering] Face ${face.id} already assigned, skipping`);
            continue;
        }

        // Check if this face belongs to an existing cluster
        let matchedCluster: FaceCluster | null = null;
        let minDistance = Infinity;

        for (const cluster of clusters) {
            const distance = faceDistance(face.descriptor, cluster.centroid);
            console.log(`[Clustering] Distance to cluster ${clusters.indexOf(cluster) + 1}: ${distance.toFixed(4)}`);

            if (distance < distanceThreshold && distance < minDistance) {
                matchedCluster = cluster;
                minDistance = distance;
            }
        }

        if (matchedCluster) {
            // Add to existing cluster
            console.log(`[Clustering] Adding face ${face.id} to existing cluster (distance: ${minDistance.toFixed(4)})`);
            matchedCluster.faceIds.push(face.id);
            assigned.add(face.id);

            // Update centroid
            const n = matchedCluster.faceIds.length;
            for (let j = 0; j < matchedCluster.centroid.length; j++) {
                matchedCluster.centroid[j] =
                    (matchedCluster.centroid[j] * (n - 1) + face.descriptor[j]) / n;
            }

            // Update photo count
            const photoIds = new Set<string>();
            for (const faceId of matchedCluster.faceIds) {
                const faceWithPhoto = facesWithPhotos.find(f => f.face.id === faceId);
                if (faceWithPhoto) photoIds.add(faceWithPhoto.photoId);
            }
            matchedCluster.photoCount = photoIds.size;

        } else {
            // Create new cluster
            const newCluster: FaceCluster = {
                id: `person-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                faceIds: [face.id],
                centroid: new Float32Array(face.descriptor),
                photoCount: 1,
                representativeFaceId: face.id,
            };

            assigned.add(face.id);
            clusters.push(newCluster);
            console.log(`[Clustering] Created NEW cluster ${clusters.length} for face ${face.id}`);
        }
    }

    // Sort by photo count (most photos first)
    const sorted = clusters.sort((a, b) => b.photoCount - a.photoCount);

    console.log(`[Clustering] ✅ FINAL RESULT: ${sorted.length} UNIQUE PEOPLE`);
    sorted.forEach((cluster, i) => {
        console.log(`  Person ${i + 1}: ${cluster.faceIds.length} faces across ${cluster.photoCount} photos`);
    });

    return sorted;
}

/**
 * Find which cluster a new face belongs to
 */
export function assignFaceToCluster(
    face: FaceDetection,
    clusters: FaceCluster[],
    distanceThreshold: number = 0.55
): string | null {
    let bestMatch: { clusterId: string; distance: number } | null = null;

    for (const cluster of clusters) {
        const distance = faceDistance(face.descriptor, cluster.centroid);

        if (distance < distanceThreshold) {
            if (!bestMatch || distance < bestMatch.distance) {
                bestMatch = { clusterId: cluster.id, distance };
            }
        }
    }

    return bestMatch?.clusterId || null;
}
