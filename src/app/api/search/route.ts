
import { NextResponse } from 'next/server';

interface SearchRequest {
    query: string;
    filters?: {
        sources?: string[];
        dateRange?: { start: string; end: string };
        colors?: string[];
    };
    mode?: 'standard' | 'deep' | 'lasso';
    limit?: number;
}

interface ImageResult {
    id: string;
    url: string;
    thumbnailUrl: string;
    source: string;
    metadata: {
        title: string;
        date?: string;
        tags?: string[];
        description?: string;
    };
    embedding?: number[];
    similarity: number;
}

interface Cluster {
    id: string;
    name: string;
    color: string;
    imageIds: string[];
}

interface SearchResponse {
    results: ImageResult[];
    clusters?: Cluster[];
    totalCount: number;
    query: string;
    processingTime: number;
}

/**
 * Generate random date within range
 */
function generateRandomDate(start: string, end: string): string {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const randomTime = startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime());
    return new Date(randomTime).toISOString().split('T')[0];
}

/**
 * Generate clusters for deep mode
 */
function generateClusters(results: ImageResult[]): Cluster[] {
    const clusterCount = Math.min(5, Math.ceil(results.length / 20));
    const clusters: Cluster[] = [];

    for (let i = 0; i < clusterCount; i++) {
        clusters.push({
            id: `cluster_${i}`,
            name: `Topic ${i + 1}`,
            color: ['#FF6B35', '#4ECDC4', '#FFD23F', '#9B59B6', '#E74C3C'][i],
            imageIds: results
                .slice(i * Math.floor(results.length / clusterCount), (i + 1) * Math.floor(results.length / clusterCount))
                .map(r => r.id),
        });
    }

    return clusters;
}

/**
 * Mock search function
 */
async function mockSearchImages(
    query: string,
    limit: number,
    filters?: SearchRequest['filters']
): Promise<ImageResult[]> {
    const results: ImageResult[] = [];
    const sources = ['Unsplash', 'Pexels', 'Vogue Runway', 'eBay', 'Archive.org'];
    const tags = query.toLowerCase().split(' ').filter(word => word.length > 3);

    for (let i = 0; i < limit; i++) {
        // Simulate varying similarity scores
        const similarity = Math.max(0.5, 1 - (i / limit) * 0.5 + (Math.random() * 0.1 - 0.05));

        // Filter by source if specified
        let source = sources[Math.floor(Math.random() * sources.length)];
        if (filters?.sources && filters.sources.length > 0) {
            source = filters.sources[Math.floor(Math.random() * filters.sources.length)];
        }

        // Generate random date within range if specified
        let date = generateRandomDate('2000-01-01', '2024-12-31');
        if (filters?.dateRange) {
            date = generateRandomDate(filters.dateRange.start, filters.dateRange.end);
        }

        // Uses picsum.photos for mock images
        // We add a random seed based on query and index to get different images
        const seed = `${encodeURIComponent(query)}-${i}`;

        results.push({
            id: `img_${i}_${Date.now()}`,
            url: `https://picsum.photos/seed/${seed}/1200/1200`,
            thumbnailUrl: `https://picsum.photos/seed/${seed}/400/400`,
            source,
            metadata: {
                title: `${query} - Result ${i + 1}`,
                date,
                tags: [...tags, source.toLowerCase()],
                description: `Related to ${query}`,
            },
            similarity,
        });
    }

    // Sort by similarity descending
    return results.sort((a, b) => b.similarity - a.similarity);
}

import { searchGoogleImages } from '@/lib/search/googleSearch';

export async function POST(request: Request) {
    try {
        const body: SearchRequest = await request.json();
        const { query, filters, mode = 'standard', limit = 100 } = body;

        const startTime = Date.now();

        if (!query || query.trim().length === 0) {
            return NextResponse.json({ error: 'Query is required' }, { status: 400 });
        }

        let results: ImageResult[] = [];

        // Check for Google API keys
        const apiKey = process.env.GOOGLE_CS_API_KEY;
        const cx = process.env.GOOGLE_CS_CX;

        if (apiKey && cx) {
            console.log('Using Google Custom Search API');
            const googleResults = await searchGoogleImages(query, apiKey, cx, limit);
            // Map ImageData to ImageResult (they are compatible/same structure mostly)
            results = googleResults.map(img => ({
                ...img,
                source: img.metadata?.source || 'Google',
                metadata: {
                    title: img.metadata?.title || '',
                    date: img.metadata?.date,
                    tags: img.metadata?.tags,
                    description: img.metadata?.description,
                }
            }));
        } else {
            console.log('Using Mock Search');
            // Mock delay to simulate network/AI processing
            await new Promise(resolve => setTimeout(resolve, 1000));
            results = await mockSearchImages(query, limit, filters);
        }

        const processingTime = Date.now() - startTime;

        const response: SearchResponse = {
            results,
            totalCount: results.length,
            query,
            processingTime,
        };

        if (mode === 'deep') {
            response.clusters = generateClusters(results);
        }

        return NextResponse.json(response);
    } catch (error) {
        console.error('Search error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
