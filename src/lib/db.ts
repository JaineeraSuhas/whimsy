import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { FaceDetection } from './face-detection';

export interface PhotoMetadata {
    id: string;
    originalName: string;
    date: number; // timestamp
    width: number;
    height: number;
    mimeType: string;
    exif?: Record<string, any>;
    embedding?: number[]; // For AI features later
}

// Storing the actual image data in IndexedDB
export interface Photo {
    id: string;
    blob: Blob; // The full image
    thumbnail: Blob; // Compressed thumbnail for the spiral
    metadata: PhotoMetadata;
    createdAt: number;
    faces?: FaceDetection[]; // Detected faces in this photo
}

export interface DetectedPerson {
    id: string;
    name: string; // Auto-generated or user-assigned
    faceIds: string[]; // IDs of faces belonging to this person
    anchors?: Float32Array[]; // High-quality descriptors (poses)
    skinTone?: { r: number; g: number; b: number };
    thumbnailBlob: Blob; // Face thumbnail
    photoCount: number; // Number of photos containing this person
    createdAt: number;
}

interface SpiralDB extends DBSchema {
    photos: {
        key: string;
        value: Photo;
        indexes: { 'by-date': number };
    };
    people: {
        key: string;
        value: DetectedPerson;
        indexes: { 'by-photo-count': number };
    };
}

const DB_NAME = 'spiral-db';
const DB_VERSION = 4; // Incremented to force schema refresh (Fix for stuck processing)

let dbPromise: Promise<IDBPDatabase<SpiralDB>>;

export const initDB = () => {
    if (!dbPromise) {
        dbPromise = openDB<SpiralDB>(DB_NAME, DB_VERSION, {
            upgrade(db: IDBPDatabase<SpiralDB>, oldVersion, newVersion, transaction) {
                // Create photos store if it doesn't exist
                if (!db.objectStoreNames.contains('photos')) {
                    const photosStore = db.createObjectStore('photos', { keyPath: 'id' });
                    photosStore.createIndex('by-date', 'metadata.date');
                }

                // Create people store for face detection
                if (!db.objectStoreNames.contains('people')) {
                    const peopleStore = db.createObjectStore('people', { keyPath: 'id' });
                    peopleStore.createIndex('by-photo-count', 'photoCount');
                } else {
                    // Ensure index exists if store already exists (migration fix)
                    const peopleStore = transaction.objectStore('people');
                    if (!peopleStore.indexNames.contains('by-photo-count')) {
                        peopleStore.createIndex('by-photo-count', 'photoCount');
                    }
                }
            },
        });
    }
    return dbPromise;
};

// Export getDB as alias for initDB to allow direct database access
export const getDB = initDB;

export const savePhoto = async (photo: Photo) => {
    const db = await initDB();
    return db.put('photos', photo);
};

export const getAllPhotos = async () => {
    const db = await initDB();
    return db.getAllFromIndex('photos', 'by-date');
};

export const getPhotoById = async (id: string) => {
    const db = await initDB();
    return db.get('photos', id);
};

export const deletePhoto = async (id: string) => {
    const db = await initDB();
    return db.delete('photos', id);
};

export const clearAllPhotos = async () => {
    const db = await initDB();
    const tx = db.transaction(['photos', 'people'], 'readwrite');
    await tx.objectStore('photos').clear();
    await tx.objectStore('people').clear();
    await tx.done;
};

// People management functions
export const savePerson = async (person: DetectedPerson) => {
    const db = await initDB();
    return db.put('people', person);
};

export const getAllPeople = async () => {
    const db = await initDB();
    return db.getAllFromIndex('people', 'by-photo-count');
};

export const getPersonById = async (id: string) => {
    const db = await initDB();
    return db.get('people', id);
};

export const deletePerson = async (id: string) => {
    const db = await initDB();
    return db.delete('people', id);
};

export const updatePersonName = async (id: string, newName: string) => {
    const db = await initDB();
    const tx = db.transaction('people', 'readwrite');
    const person = await tx.store.get(id);
    if (!person) return;

    person.name = newName;
    await tx.store.put(person);
    await tx.done;
};

export const getPhotosByPerson = async (personId: string) => {
    const db = await initDB();
    const person = await db.get('people', personId);
    if (!person) return [];

    const allPhotos = await db.getAll('photos');
    return allPhotos.filter(photo =>
        photo.faces?.some(face => person.faceIds.includes(face.id))
    );
};

export const getPhotosByPeople = async (personIds: string[]) => {
    console.log('[DB] getPhotosByPeople called with IDs:', personIds);
    if (personIds.length === 0) return [];
    const db = await initDB();

    // Get all target face IDs from selected people
    const people = await Promise.all(personIds.map(id => db.get('people', id)));
    console.log('[DB] Retrieved people:', people);

    const targetFaceIds = new Set(
        people.flatMap(p => p?.faceIds || [])
    );
    console.log('[DB] Target Face IDs:', Array.from(targetFaceIds));

    const allPhotos = await db.getAll('photos');
    console.log(`[DB] Scanning ${allPhotos.length} photos for matches...`);

    const matches = allPhotos.filter(photo => {
        const hasMatch = photo.faces?.some(face => targetFaceIds.has(face.id));
        if (hasMatch) {
            console.log(`[DB] Match found in photo ${photo.id}`);
        }
        return hasMatch;
    });

    console.log(`[DB] Found ${matches.length} matching photos`);
    return matches;
};
