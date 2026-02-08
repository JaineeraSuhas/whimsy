import { FaceDetection, faceDistance } from './face-detection';

export interface FaceCluster {
    id: string;
    faceIds: string[];
    anchors: Float32Array[]; // Multiple high-quality descriptors for different poses
    skinTone?: { r: number; g: number; b: number };
    photoCount: number;
    representativeFaceId: string;
    qualityScore: number; // For sorting best clusters
}

interface ClusterNode {
    id: string;
    faces: Array<{ face: FaceDetection; photoId: string }>;
    photoIds: Set<string>;
    merged: boolean;
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
 * iOS Style: 60% Embedding, 20% Landmarks, 15% Skin, 5% Shape
 */
function calculateWeightedDistance(face1: FaceDetection, face2: FaceDetection): number {
    // 1. Embedding distance (60% weight)
    const dist = faceDistance(face1.descriptor, face2.descriptor);

    // 2. Face shape ratio distance (5% weight)
    const ratio1 = face1.box.height / face1.box.width;
    const ratio2 = face2.box.height / face2.box.width;
    const ratioDist = Math.abs(ratio1 - ratio2);

    // 3. Landmark proportions (20% weight)
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

    // 4. Skin tone similarity (15% weight)
    const toneDist = skinToneSimilarity(face1.skinTone, face2.skinTone);

    return (dist * 0.60) + (Math.min(ratioDist, 1) * 0.05) + (Math.min(landmarkDist, 1) * 0.20) + (toneDist * 0.15);
}

/**
 * Cluster faces using Constrained Hierarchical Agglomerative Clustering (HAC)
 * Constraints:
 * 1. Two faces from the SAME photo can NEVER be in the same cluster (Co-occurrence constraint)
 * 2. Distance threshold determines cut-off
 */
export function clusterFaces(
    allFaces: Map<string, FaceDetection[]>,
    distanceThreshold: number = 0.28 // Tuned for high precision (iOS standard is typically 0.25-0.30 for loose matching)
): FaceCluster[] {
    // 1. Flatten all faces
    const nodes: ClusterNode[] = [];
    for (const [photoId, faces] of allFaces.entries()) {
        for (const face of faces) {
            nodes.push({
                id: face.id,
                faces: [{ face, photoId }],
                photoIds: new Set([photoId]),
                merged: false
            });
        }
    }

    if (nodes.length === 0) return [];

    // 2. Build Initial Distance Matrix (Upper Triangular)
    // Map key: "smallerIndex-largerIndex" -> distance
    const distMatrix = new Map<string, number>();

    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            // Optimization: If faces are from same photo, distance is INFINITY (constraint)
            if (nodes[i].photoIds.has([...nodes[j].photoIds][0])) {
                distMatrix.set(`${i}-${j}`, Infinity);
                continue;
            }

            const d = calculateWeightedDistance(nodes[i].faces[0].face, nodes[j].faces[0].face);
            if (d < distanceThreshold) {
                distMatrix.set(`${i}-${j}`, d);
            }
        }
    }

    // 3. Hierarchical Clustering Loop
    // Iteratively merge closest clusters that satisfy constraints
    const currentClusters = nodes.map((_, idx) => idx); // Tracks active cluster indices
    const activeIndices = new Set(currentClusters);

    while (activeIndices.size > 1) {
        let minDist = Infinity;
        let mergePair: [number, number] | null = null;

        // Find best valid merge pair
        const indices = Array.from(activeIndices);
        for (let i = 0; i < indices.length; i++) {
            for (let j = i + 1; j < indices.length; j++) {
                const idx1 = indices[i];
                const idx2 = indices[j];

                // Construct key (smaller-larger)
                const key = idx1 < idx2 ? `${idx1}-${idx2}` : `${idx2}-${idx1}`;
                const dist = distMatrix.get(key);

                if (dist !== undefined && dist < minDist) {
                    // Check Co-occurrence Constraint
                    // Can merge ONLY if sets of photo IDs are disjoint
                    const c1 = nodes[idx1];
                    const c2 = nodes[idx2];

                    let conflict = false;
                    for (const pid of c2.photoIds) {
                        if (c1.photoIds.has(pid)) {
                            conflict = true;
                            break;
                        }
                    }

                    if (!conflict) {
                        minDist = dist;
                        mergePair = [idx1, idx2];
                    }
                }
            }
        }

        // If no valid merge found below threshold, stop
        if (!mergePair || minDist >= distanceThreshold) break;

        // Perform Merge
        const [idx1, idx2] = mergePair; // idx1 < idx2
        const c1 = nodes[idx1];
        const c2 = nodes[idx2];

        // Mark c2 as merged (inactive)
        activeIndices.delete(idx2);

        // Merge c2 into c1
        c1.faces.push(...c2.faces);
        for (const pid of c2.photoIds) c1.photoIds.add(pid);

        // Update Distances for new c1 (Average Linkage)
        // Re-calculate distances between new c1 and all other active clusters
        for (const otherIdx of activeIndices) {
            if (otherIdx === idx1) continue;

            const other = nodes[otherIdx];

            // Calculate Average Linkage Distance
            // Sum of all pairwise distances between faces in c1 and faces in other
            // Divided by (Ac * Bc)
            let totalDist = 0;
            let count = 0;

            for (const f1 of c1.faces) {
                for (const f2 of other.faces) {
                    totalDist += calculateWeightedDistance(f1.face, f2.face);
                    count++;
                }
            }

            const avgDist = count > 0 ? totalDist / count : Infinity;

            // Update matrix
            const key = idx1 < otherIdx ? `${idx1}-${otherIdx}` : `${otherIdx}-${idx1}`;
            if (avgDist < distanceThreshold) {
                distMatrix.set(key, avgDist);
            } else {
                distMatrix.delete(key);
            }
        }
    }

    // 4. Convert Resulting Clusters to Output Format
    const finalClusters: FaceCluster[] = [];

    for (const idx of activeIndices) {
        const clusterNode = nodes[idx];
        const faces = clusterNode.faces.map(f => f.face);
        const uniquePhotoCount = clusterNode.photoIds.size;

        // Select Anchors (Top 5 Highest Quality Faces)
        // Quality = Score (Face confidence) + Frontality (implied by score/landmarks)
        const sortedByQuality = [...faces].sort((a, b) => (b.score || 0) - (a.score || 0));
        const anchors = sortedByQuality.slice(0, 5).map(f => f.descriptor);

        // Select Representative Face (Highest Quality)
        const bestFace = sortedByQuality[0];

        // Overall Cluster Score
        const clusterQuality = sortedByQuality.reduce((acc, f) => acc + (f.score || 0), 0) / faces.length;

        // Generate Stable ID based on the best face's ID + count
        // Using existing IDs if available would be better, but generating fresh unique ID for cluster
        const clusterId = `cluster-${uniquePhotoCount}-${bestFace.id.substring(0, 8)}`;

        finalClusters.push({
            id: clusterId,
            faceIds: faces.map(f => f.id),
            anchors: anchors,
            skinTone: bestFace.skinTone,
            photoCount: uniquePhotoCount,
            representativeFaceId: bestFace.id,
            qualityScore: clusterQuality
        });
    }

    // Sort clusters by photo count (importance)
    return finalClusters.sort((a, b) => b.photoCount - a.photoCount);
}

/**
 * Assign a single new face to a cluster (Optimized for quick addition)
 */
export function assignFaceToCluster(
    face: FaceDetection,
    clusters: FaceCluster[],
    distanceThreshold: number = 0.28
): string | null {
    let bestMatch: { clusterId: string; distance: number } | null = null;

    // Check against all existing clusters
    for (const cluster of clusters) {
        // Average distance to all anchors
        let totalDist = 0;
        for (const anchor of cluster.anchors) {
            totalDist += faceDistance(face.descriptor, anchor);
        }
        const avgDist = totalDist / cluster.anchors.length;

        if (avgDist < distanceThreshold) {
            if (!bestMatch || avgDist < bestMatch.distance) {
                bestMatch = { clusterId: cluster.id, distance: avgDist };
            }
        }
    }

    return bestMatch?.clusterId || null;
}
