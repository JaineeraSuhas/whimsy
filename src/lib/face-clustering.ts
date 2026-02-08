import { FaceDetection, faceDistance } from './face-detection';

export interface FaceCluster {
    id: string;
    faceIds: string[];
    anchors: Float32Array[];
    skinTone?: { r: number; g: number; b: number };
    photoCount: number;
    representativeFaceId: string;
    qualityScore: number;
}

interface ClusterNode {
    id: string;
    faces: Array<{ face: FaceDetection; photoId: string }>;
    photoIds: Set<string>;
    merged: boolean;
}

/**
 * Calculate similarity between skin tones (0 to 1, where 0 is identical)
 */
function skinToneSimilarity(t1?: { r: number, g: number, b: number }, t2?: { r: number, g: number, b: number }): number {
    if (!t1 || !t2) return 1.0;
    const dist = Math.sqrt(
        Math.pow(t1.r - t2.r, 2) +
        Math.pow(t1.g - t2.g, 2) +
        Math.pow(t1.b - t2.b, 2)
    );
    return dist / 441.67; // Normalize max distance
}

/**
 * iOS-Style Weighted Distance Calculation
 * Weights: Embedding (60%), Landmarks (20%), Skin (15%), Shape (5%)
 */
function calculateWeightedDistance(face1: FaceDetection, face2: FaceDetection): number {
    // 1. Embedding distance (60%)
    const dist = faceDistance(face1.descriptor, face2.descriptor);

    // 2. Shape Ratio (5%)
    const ratio1 = face1.box.height / face1.box.width;
    const ratio2 = face2.box.height / face2.box.width;
    const ratioDist = Math.abs(ratio1 - ratio2);

    // 3. Landmarks (20%)
    let landmarkDist = 0;
    if (face1.landmarks && face2.landmarks) {
        try {
            const getProp = (lm: any) => {
                const pos = lm.positions;
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

    // 4. Skin Tone (15%)
    const toneDist = skinToneSimilarity(face1.skinTone, face2.skinTone);

    return (dist * 0.60) + (Math.min(ratioDist, 1) * 0.05) + (Math.min(landmarkDist, 1) * 0.20) + (toneDist * 0.15);
}

/**
 * Cluster faces using Strict Hierarchical Agglomerative Clustering (HAC)
 * Includes Graph-Based Temporal Refinement for co-occurrence.
 */
export function clusterFaces(
    allFaces: Map<string, FaceDetection[]>,
    distanceThreshold: number = 0.65 // Tuned for generic face-api.js Euclidean (equivalent to ~0.28 Cosine)
): FaceCluster[] {
    // 1. Initialize Nodes
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

    // 2. Build Distance Matrix (Upper Triangular)
    const distMatrix = new Map<string, number>();
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            // Constraint: Infinite distance if same photo
            const p1 = nodes[i].photoIds.values().next().value;
            const p2 = nodes[j].photoIds.values().next().value;

            if (p1 === p2) {
                distMatrix.set(`${i}-${j}`, Infinity);
                continue;
            }

            const d = calculateWeightedDistance(nodes[i].faces[0].face, nodes[j].faces[0].face);
            if (d < distanceThreshold) {
                distMatrix.set(`${i}-${j}`, d);
            }
        }
    }

    // 3. Hierarchical Clustering (Average Linkage)
    const activeIndices = new Set(nodes.map((_, i) => i));

    while (activeIndices.size > 1) {
        let minDist = Infinity;
        let mergePair: [number, number] | null = null;
        const indices = Array.from(activeIndices);

        for (let i = 0; i < indices.length; i++) {
            for (let j = i + 1; j < indices.length; j++) {
                const idx1 = indices[i];
                const idx2 = indices[j];
                const key = idx1 < idx2 ? `${idx1}-${idx2}` : `${idx2}-${idx1}`;
                const dist = distMatrix.get(key);

                if (dist !== undefined && dist < minDist) {
                    minDist = dist;
                    mergePair = [idx1, idx2];
                }
            }
        }

        if (!mergePair || minDist >= distanceThreshold) break;

        const [idx1, idx2] = mergePair;
        const c1 = nodes[idx1];
        const c2 = nodes[idx2];

        // CHECK VALIDITY (Co-occurrence)
        // Ensure no photo overlap between c1 and c2
        let conflict = false;
        for (const pid of c2.photoIds) {
            if (c1.photoIds.has(pid)) {
                conflict = true;
                break;
            }
        }

        if (conflict) {
            // Cannot merge these two clusters
            // Remove distance from matrix to prevent re-checking
            const key = idx1 < idx2 ? `${idx1}-${idx2}` : `${idx2}-${idx1}`;
            distMatrix.delete(key);
            continue;
        }

        // MERGE c2 into c1
        activeIndices.delete(idx2);
        c1.faces.push(...c2.faces);
        for (const pid of c2.photoIds) c1.photoIds.add(pid);

        // Update Distances (Average Linkage)
        for (const otherIdx of activeIndices) {
            if (otherIdx === idx1) continue;

            const other = nodes[otherIdx];
            let totalDist = 0;
            let count = 0;

            for (const f1 of c1.faces) {
                for (const f2 of other.faces) {
                    totalDist += calculateWeightedDistance(f1.face, f2.face);
                    count++;
                }
            }

            const avgDist = count > 0 ? totalDist / count : Infinity;
            const key = idx1 < otherIdx ? `${idx1}-${otherIdx}` : `${otherIdx}-${idx1}`;

            if (avgDist < distanceThreshold) {
                distMatrix.set(key, avgDist);
            } else {
                distMatrix.delete(key);
            }
        }
    }

    // 4. Temporal Refinement (Graph Splitting) & Final formatting
    const finalClusters: FaceCluster[] = [];

    for (const idx of activeIndices) {
        const clusterNode = nodes[idx];

        // Robust graph splitting for complex merges
        const subClusters = splitByCooccurrence(clusterNode.faces);

        for (const subClusterFaces of subClusters) {
            if (subClusterFaces.length === 0) continue;

            const faces = subClusterFaces.map(f => f.face);
            // Sort by QUALITY score (High quality first)
            const sortedByQuality = [...faces].sort((a, b) => (b.quality || 0) - (a.quality || 0));

            // Anchors: Top 5 best quality
            const anchors = sortedByQuality.slice(0, 5).map(f => f.descriptor);
            const bestFace = sortedByQuality[0];
            const clusterQuality = sortedByQuality.reduce((acc, f) => acc + (f.quality || 0), 0) / faces.length;

            const uniquePhotoCount = new Set(subClusterFaces.map(f => f.photoId)).size;

            finalClusters.push({
                id: `cluster-${uniquePhotoCount}-${bestFace.id.substring(0, 8)}`,
                faceIds: faces.map(f => f.id),
                anchors: anchors,
                skinTone: bestFace.skinTone,
                photoCount: uniquePhotoCount,
                representativeFaceId: bestFace.id,
                qualityScore: clusterQuality
            });
        }
    }

    return finalClusters.sort((a, b) => b.photoCount - a.photoCount);
}

/**
 * Split a cluster into sub-clusters if it contains faces from the same photo.
 * Uses a graph where edges exist ONLY between faces that do NOT share a photo.
 * Connected components constitute valid sub-clusters.
 */
function splitByCooccurrence(faces: Array<{ face: FaceDetection; photoId: string }>): Array<Array<{ face: FaceDetection; photoId: string }>> {
    const adj: number[][] = Array.from({ length: faces.length }, () => []);

    for (let i = 0; i < faces.length; i++) {
        for (let j = i + 1; j < faces.length; j++) {
            // Edge exists if they are NOT from the same photo (compatible)
            if (faces[i].photoId !== faces[j].photoId) {
                adj[i].push(j);
                adj[j].push(i);
            }
        }
    }

    const visited = new Set<number>();
    const components: Array<Array<{ face: FaceDetection; photoId: string }>> = [];

    for (let i = 0; i < faces.length; i++) {
        if (visited.has(i)) continue;

        const componentIndices: number[] = [];
        const queue = [i];
        visited.add(i);

        while (queue.length > 0) {
            const curr = queue.shift()!;
            componentIndices.push(curr);

            for (const neighbor of adj[curr]) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push(neighbor);
                }
            }
        }

        components.push(componentIndices.map(idx => faces[idx]));
    }

    // Validation: Ensure no single component has duplicates
    const validComponents: Array<Array<{ face: FaceDetection; photoId: string }>> = [];

    for (const comp of components) {
        const photoCounts = new Map<string, number>();
        let hasConflict = false;
        for (const f of comp) {
            photoCounts.set(f.photoId, (photoCounts.get(f.photoId) || 0) + 1);
            if (photoCounts.get(f.photoId)! > 1) {
                hasConflict = true;
                break;
            }
        }

        if (!hasConflict) {
            validComponents.push(comp);
        } else {
            for (const f of comp) validComponents.push([f]);
        }
    }

    return validComponents;
}

/**
 * Assign a single new face to a cluster using weighted distance
 */
export function assignFaceToCluster(
    face: FaceDetection,
    clusters: FaceCluster[],
    distanceThreshold: number = 0.65
): string | null {
    let bestMatch: { clusterId: string; distance: number } | null = null;

    for (const cluster of clusters) {
        let totalDist = 0;
        for (const anchor of cluster.anchors) {
            totalDist += calculateWeightedDistance(face, { descriptor: anchor } as any);
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
