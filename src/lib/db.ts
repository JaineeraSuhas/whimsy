/**
 * db.ts — IndexedDB via idb
 * Unchanged schema, cleaned up for correctness and a version bump.
 */

import { openDB, DBSchema, IDBPDatabase } from "idb";
import { FaceDetection } from "./face-detection";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PhotoMetadata {
  id: string;
  originalName: string;
  date: number;
  width: number;
  height: number;
  mimeType: string;
  exif?: Record<string, unknown>;
  embedding?: number[];
}

export interface Photo {
  id: string;
  blob: Blob;
  thumbnail: Blob;
  metadata: PhotoMetadata;
  createdAt: number;
  faces?: FaceDetection[];
}

export interface DetectedPerson {
  id: string;
  name: string;
  faceIds: string[];
  anchors?: Float32Array[];
  skinTone?: { r: number; g: number; b: number };
  thumbnailBlob: Blob;
  photoCount: number;
  createdAt: number;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

interface SpiralDB extends DBSchema {
  photos: {
    key: string;
    value: Photo;
    indexes: { "by-date": number };
  };
  people: {
    key: string;
    value: DetectedPerson;
    indexes: { "by-photo-count": number };
  };
}

const DB_NAME = "spiral-db";
const DB_VERSION = 5; // bump to ensure clean migration from face-api to MediaPipe

// ─── Init ─────────────────────────────────────────────────────────────────────

let dbPromise: Promise<IDBPDatabase<SpiralDB>>;

export const initDB = (): Promise<IDBPDatabase<SpiralDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<SpiralDB>(DB_NAME, DB_VERSION, {
      upgrade(db, _old, _new, tx) {
        if (!db.objectStoreNames.contains("photos")) {
          const photos = db.createObjectStore("photos", { keyPath: "id" });
          photos.createIndex("by-date", "metadata.date");
        }

        if (!db.objectStoreNames.contains("people")) {
          const people = db.createObjectStore("people", { keyPath: "id" });
          people.createIndex("by-photo-count", "photoCount");
        } else {
          const people = tx.objectStore("people");
          if (!people.indexNames.contains("by-photo-count")) {
            people.createIndex("by-photo-count", "photoCount");
          }
        }
      },
    });
  }
  return dbPromise;
};

export const getDB = initDB;

// ─── Photos ───────────────────────────────────────────────────────────────────

export const savePhoto = async (photo: Photo) => {
  const db = await initDB();
  return db.put("photos", photo);
};

export const getAllPhotos = async () => {
  const db = await initDB();
  const photos = await db.getAllFromIndex("photos", "by-date");
  return photos.map(p => {
    if (p.faces) {
      p.faces.forEach(f => {
        if (f.descriptor) f.descriptor = new Float32Array(f.descriptor);
      });
    }
    return p;
  });
};

export const getPhotoById = async (id: string) => {
  const db = await initDB();
  const p = await db.get("photos", id);
  if (p?.faces) {
    p.faces.forEach(f => {
      if (f.descriptor) f.descriptor = new Float32Array(f.descriptor);
    });
  }
  return p;
};

export const deletePhoto = async (id: string) => {
  const db = await initDB();
  return db.delete("photos", id);
};

export const clearAllPhotos = async () => {
  const db = await initDB();
  const tx = db.transaction(["photos", "people"], "readwrite");
  await tx.objectStore("photos").clear();
  await tx.objectStore("people").clear();
  await tx.done;
};

// ─── People ───────────────────────────────────────────────────────────────────

export const savePerson = async (person: DetectedPerson) => {
  const db = await initDB();
  return db.put("people", person);
};

export const getAllPeople = async () => {
  const db = await initDB();
  const people = await db.getAllFromIndex("people", "by-photo-count");
  return people.map(p => {
    if (p.anchors) p.anchors = p.anchors.map(a => new Float32Array(a));
    return p;
  });
};

export const getPersonById = async (id: string) => {
  const db = await initDB();
  const p = await db.get("people", id);
  if (p?.anchors) p.anchors = p.anchors.map(a => new Float32Array(a));
  return p;
};

export const deletePerson = async (id: string) => {
  const db = await initDB();
  return db.delete("people", id);
};

export const updatePersonName = async (id: string, newName: string) => {
  const db = await initDB();
  const tx = db.transaction("people", "readwrite");
  const person = await tx.store.get(id);
  if (!person) return;
  person.name = newName;
  await tx.store.put(person);
  await tx.done;
};

// ─── Cross-reference queries ──────────────────────────────────────────────────

export const getPhotosByPerson = async (personId: string) => {
  const db = await initDB();
  const person = await db.get("people", personId);
  if (!person) return [];
  const allPhotos = await getAllPhotos();
  const ids = new Set(person.faceIds);
  return allPhotos.filter((p) => p.faces?.some((f) => ids.has(f.id)));
};

export const getPhotosByPeople = async (personIds: string[]) => {
  if (personIds.length === 0) return [];
  const db = await initDB();

  const people = await Promise.all(personIds.map((id) => getPersonById(id)));
  const targetFaceIds = new Set(people.flatMap((p) => p?.faceIds ?? []));

  const allPhotos = await getAllPhotos();
  return allPhotos.filter((photo) =>
    photo.faces?.some((face) => targetFaceIds.has(face.id))
  );
};
