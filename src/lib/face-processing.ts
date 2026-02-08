import { detectFaces, extractFaceThumbnail } from './face-detection';
import { clusterFaces, assignFaceToCluster } from './face-clustering';
import {
    Photo,
    DetectedPerson,
    getAllPhotos,
    getAllPeople,
    savePerson,
    savePhoto,
    getDB
} from './db';

// State tracking for UI
export type ProcessingState = 'idle' | 'detecting' | 'clustering';
let currentState: ProcessingState = 'idle';
const subscribers = new Set<(state: ProcessingState) => void>();

export function getProcessingState() {
    return currentState;
}

export function subscribeToProcessingState(callback: (state: ProcessingState) => void) {
    subscribers.add(callback);
    callback(currentState); // Initial call
    return () => subscribers.delete(callback);
}

function setState(state: ProcessingState) {
    if (currentState === state) return;
    currentState = state;
    console.log(`[Face Processing] State changed to: ${state}`);
    subscribers.forEach(cb => cb(state));
}

// Debounce timer for re-clustering
let reclusterTimeout: NodeJS.Timeout | null = null;

/**
 * Process faces in a newly uploaded photo
 */
export async function processFacesInPhoto(photo: Photo): Promise<Photo> {
    try {
        // Detect faces in the photo
        const faces = await detectFaces(photo.blob);

        if (faces.length === 0) {
            console.log(`[Face Processing] No faces detected in photo ${photo.id}`);
            return photo;
        }

        console.log(`[Face Processing] ✅ Detected ${faces.length} faces in photo ${photo.id}`);

        // Update photo with detected faces
        const updatedPhoto = { ...photo, faces };
        await savePhoto(updatedPhoto);

        // Debounce re-clustering to avoid race conditions during batch uploads
        if (reclusterTimeout) {
            clearTimeout(reclusterTimeout);
        }

        reclusterTimeout = setTimeout(() => {
            updatePeopleClusters();
        }, 500); // Wait 500ms after last upload before re-clustering

        return updatedPhoto;
    } catch (error) {
        console.error('[Face Processing] Error processing faces:', error);
        return photo;
    }
}

/**
 * Re-cluster all faces and update people
 * ENSURES EXACTLY ONE PERSON PER UNIQUE FACE
 */
// Concurrency Lock
let isClustering = false;

/**
 * Re-cluster all faces and update people
 * ENSURES EXACTLY ONE PERSON PER UNIQUE FACE
 */
export async function updatePeopleClusters(): Promise<void> {
    if (isClustering) {
        console.warn('[Face Processing] ⏳ Re-clustering already in progress, skipping...');
        return;
    }

    isClustering = true;

    try {
        console.log('[Face Processing] 🔄 Starting re-clustering...');

        const allPhotos = await getAllPhotos();

        // Collect all faces from all photos
        const facesMap = new Map<string, any[]>();
        let totalFaces = 0;

        for (const photo of allPhotos) {
            if (photo.faces && photo.faces.length > 0) {
                facesMap.set(photo.id, photo.faces);
                totalFaces += photo.faces.length;
            }
        }

        if (facesMap.size === 0) {
            console.log('[Face Processing] No faces found in any photos');
            const db = await getDB();
            const tx = db.transaction('people', 'readwrite');
            await tx.store.clear();
            await tx.done;
            isClustering = false;
            return;
        }

        console.log(`[Face Processing] Found ${totalFaces} faces in ${facesMap.size} photos`);

        // 1. PRESERVE NAMES: Map every Face ID to its existing Person Name
        const existingPeople = await getAllPeople();
        const faceToNameMap = new Map<string, string>();
        for (const p of existingPeople) {
            if (p.name.startsWith('Person ')) continue; // Don't preserve auto-generated names
            for (const fid of p.faceIds) {
                faceToNameMap.set(fid, p.name);
            }
        }

        // 2. CLUSTER FACES (New Strict Logic)
        const clusters = clusterFaces(facesMap);
        console.log(`[Face Processing] ✅ Created ${clusters.length} UNIQUE person clusters`);

        // 3. PREPARE NEW PEOPLE DATA
        const peopleToSave: DetectedPerson[] = [];

        for (let i = 0; i < clusters.length; i++) {
            const cluster = clusters[i];

            // Resolve Name: Vote based on preserved names of faces in this cluster
            const nameCounts = new Map<string, number>();
            for (const fid of cluster.faceIds) {
                const name = faceToNameMap.get(fid);
                if (name) nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
            }

            // Find most frequent name
            let bestName = `Person ${i + 1}`;
            let maxCount = 0;
            for (const [name, count] of nameCounts.entries()) {
                if (count > maxCount) {
                    maxCount = count;
                    bestName = name;
                }
            }

            // Find representative face thumbnail
            let thumbnailBlob: Blob | null = null;
            let faceBox: any = null;
            let sourcePhoto: Photo | null = null;

            for (const photo of allPhotos) {
                if (!photo.faces) continue;
                const face = photo.faces.find(f => f.id === cluster.representativeFaceId);
                if (face) {
                    faceBox = face.box;
                    sourcePhoto = photo;
                    break;
                }
            }

            if (sourcePhoto && faceBox) {
                try {
                    thumbnailBlob = await extractFaceThumbnail(sourcePhoto.blob, faceBox);
                } catch (err) {
                    console.error(`[Face Processing] ❌ Failed to extract thumbnail:`, err);
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

        // 4. ATOMIC DB UPDATE
        const db = await getDB();
        const tx = db.transaction('people', 'readwrite');
        await tx.store.clear();
        for (const person of peopleToSave) {
            await tx.store.put(person);
        }
        await tx.done;

        console.log(`[Face Processing] 🎉 COMPLETE: ${peopleToSave.length} unique people saved`);

    } catch (error) {
        console.error('[Face Processing] ❌ Error updating people clusters:', error);
    } finally {
        isClustering = false;
    }
}

/**
 * Get people with their thumbnail URLs
 */
export async function getPeopleWithThumbnails(): Promise<Array<{
    id: string;
    name: string;
    thumbnailUrl?: string;
    thumbnailBlob?: Blob;
    photoCount: number;
}>> {
    const people = await getAllPeople();
    console.log(`[Face Processing] 📊 Retrieved ${people.length} UNIQUE people from database`);

    // Remove duplicates by ID (just in case)
    const uniquePeople = Array.from(
        new Map(people.map(p => [p.id, p])).values()
    );

    if (uniquePeople.length !== people.length) {
        console.warn(`[Face Processing] ⚠️ Found ${people.length - uniquePeople.length} duplicate people, filtered to ${uniquePeople.length}`);
    }

    const result = uniquePeople.map(person => ({
        id: person.id,
        name: person.name,
        thumbnailBlob: person.thumbnailBlob || undefined, // Pass Blob directly
        thumbnailUrl: undefined, // No more leaking URLs
        photoCount: person.photoCount,
    }));

    console.log('[Face Processing] 👥 Unique People:', result.map(p => `${p.name} (${p.photoCount} photos)`).join(', '));

    return result;
}
