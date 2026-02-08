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
export async function updatePeopleClusters(): Promise<void> {
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

            // Clear people if no faces
            const db = await getDB();
            const tx = db.transaction('people', 'readwrite');
            await tx.store.clear();
            await tx.done;
            console.log('[Face Processing] ✅ Cleared people (no faces found)');
            return;
        }

        console.log(`[Face Processing] Found ${totalFaces} faces in ${facesMap.size} photos`);

        // Cluster faces - this should give us ONE cluster per unique person
        const clusters = clusterFaces(facesMap);
        console.log(`[Face Processing] ✅ Created ${clusters.length} UNIQUE person clusters`);

        // PREPARE DATA FIRST to avoid transaction auto-close issues
        // We cannot await async tasks (like thumbnail generation) inside an IDB transaction
        const peopleToSave: DetectedPerson[] = [];

        for (let i = 0; i < clusters.length; i++) {
            const cluster = clusters[i];

            // Find the representative face for this cluster
            let thumbnailBlob: Blob | null = null;
            let faceBox: any = null;
            let sourcePhoto: Photo | null = null;

            // Use the representative face ID
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
                    // This is the async operation that was breaking the transaction
                    thumbnailBlob = await extractFaceThumbnail(sourcePhoto.blob, faceBox);
                } catch (err) {
                    console.error(`[Face Processing] ❌ Failed to extract thumbnail:`, err);
                }
            }

            if (!thumbnailBlob) {
                console.warn(`[Face Processing] ⚠️ No thumbnail for Person ${i + 1}, skipping`);
                continue;
            }

            const person: DetectedPerson = {
                id: cluster.id,
                name: `Person ${i + 1}`,
                faceIds: cluster.faceIds,
                anchors: cluster.anchors,
                skinTone: cluster.skinTone,
                thumbnailBlob,
                photoCount: cluster.photoCount,
                createdAt: Date.now(),
            };

            peopleToSave.push(person);
        }

        // NOW perform the atomic database update
        const db = await getDB();
        const tx = db.transaction('people', 'readwrite');

        // Queue clear - DO NOT AWAIT
        tx.store.clear();
        console.log(`[Face Processing] ⚡ Queued clear of existing people`);

        // Queue saves - DO NOT AWAIT
        for (const person of peopleToSave) {
            tx.store.put(person);
            console.log(`[Face Processing] ⚡ Queued save for ${person.name} (${person.id})`);
        }

        // Wait for transaction to complete
        await tx.done;
        console.log(`[Face Processing] 🎉 COMPLETE: ${peopleToSave.length} unique people saved to database`);
    } catch (error) {
        console.error('[Face Processing] ❌ Error updating people clusters:', error);
    }
}

/**
 * Get people with their thumbnail URLs
 */
export async function getPeopleWithThumbnails(): Promise<Array<{
    id: string;
    name: string;
    thumbnailUrl: string;
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
        thumbnailUrl: URL.createObjectURL(person.thumbnailBlob),
        photoCount: person.photoCount,
    }));

    console.log('[Face Processing] 👥 Unique People:', result.map(p => `${p.name} (${p.photoCount} photos)`).join(', '));

    return result;
}
