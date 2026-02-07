/**
 * Debug utility to check face detection system status
 * Open browser console and run: checkFaceDetectionStatus()
 */

import { getAllPhotos, getAllPeople, getDB } from './db';

export async function checkFaceDetectionStatus() {
    console.log('🔍 FACE DETECTION SYSTEM STATUS CHECK');
    console.log('=====================================\n');

    try {
        // Check database connection
        console.log('1️⃣ Checking database connection...');
        const db = await getDB();
        console.log('✅ Database connected:', db.name);

        // Check photos
        console.log('\n2️⃣ Checking photos...');
        const photos = await getAllPhotos();
        console.log(`📸 Total photos: ${photos.length}`);

        const photosWithFaces = photos.filter(p => p.faces && p.faces.length > 0);
        console.log(`👤 Photos with faces: ${photosWithFaces.length}`);

        if (photosWithFaces.length > 0) {
            const totalFaces = photosWithFaces.reduce((sum, p) => sum + (p.faces?.length || 0), 0);
            console.log(`🎭 Total faces detected: ${totalFaces}`);

            console.log('\nFace details:');
            photosWithFaces.forEach((photo, i) => {
                console.log(`  Photo ${i + 1}: ${photo.faces?.length} faces`);
                photo.faces?.forEach((face, j) => {
                    console.log(`    Face ${j + 1}: ID=${face.id}, descriptor length=${face.descriptor?.length || 0}`);
                });
            });
        }

        // Check people
        console.log('\n3️⃣ Checking people...');
        const people = await getAllPeople();
        console.log(`👥 Total people: ${people.length}`);

        if (people.length > 0) {
            console.log('\nPeople details:');
            people.forEach((person, i) => {
                console.log(`  ${person.name}:`);
                console.log(`    ID: ${person.id}`);
                console.log(`    Face IDs: ${person.faceIds.length}`);
                console.log(`    Photo count: ${person.photoCount}`);
                console.log(`    Has thumbnail: ${person.thumbnailBlob ? 'Yes' : 'No'}`);
            });
        }

        // Summary
        console.log('\n📊 SUMMARY');
        console.log('==========');
        console.log(`Photos: ${photos.length}`);
        console.log(`Photos with faces: ${photosWithFaces.length}`);
        console.log(`People detected: ${people.length}`);

        if (photos.length === 0) {
            console.warn('⚠️ No photos found. Upload some photos first!');
        } else if (photosWithFaces.length === 0) {
            console.warn('⚠️ No faces detected in photos. Try uploading photos with people.');
        } else if (people.length === 0) {
            console.error('❌ Faces detected but no people created! Check clustering logic.');
        } else {
            console.log('✅ System working correctly!');
        }

    } catch (error) {
        console.error('❌ Error checking status:', error);
    }
}

// Make it available globally for console access
if (typeof window !== 'undefined') {
    (window as any).checkFaceDetectionStatus = checkFaceDetectionStatus;
    console.log('💡 Debug utility loaded! Run: checkFaceDetectionStatus()');
}
