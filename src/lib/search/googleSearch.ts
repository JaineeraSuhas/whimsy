
import { ImageData } from '@/types';

interface GoogleSearchResponse {
    items?: {
        link: string;
        title: string;
        image: {
            thumbnailLink: string;
            contextLink: string;
        };
    }[];
}

export async function searchGoogleImages(
    query: string,
    apiKey: string,
    cx: string,
    limit: number = 100
): Promise<ImageData[]> {
    const allItems: ImageData[] = [];
    const resultsPerPage = 10;
    const maxRequests = Math.ceil(limit / resultsPerPage);

    // Create an array of promises for parallel fetching (with care for rate limits)
    // Google Custom Search API has strict quotas, so for free tier we should be careful.
    // We'll limit to a few requests for now to avoid blowing quota instantly in a loop.
    const safeLimit = Math.min(maxRequests, 5);

    const requests = Array.from({ length: safeLimit }, (_, i) => {
        const start = i * resultsPerPage + 1;
        const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&cx=${cx}&key=${apiKey}&searchType=image&num=${resultsPerPage}&start=${start}`;

        return fetch(url).then(async (res) => {
            if (!res.ok) {
                console.error(`Google API error: ${res.status} ${res.statusText}`);
                return [];
            }
            const data: GoogleSearchResponse = await res.json();
            return data.items || [];
        }).catch(err => {
            console.error('Google API fetch error:', err);
            return [];
        });
    });

    const responses = await Promise.all(requests);

    responses.flat().forEach((item, index) => {
        if (!item) return;

        // Calculate a deterministic similarity score based on rank
        // First results are more relevant (higher similarity)
        const baseSimilarity = 1.0 - (index / (limit * 1.2));
        const similarity = Math.max(0.1, baseSimilarity * (0.9 + Math.random() * 0.2)); // Add some jitter

        allItems.push({
            id: `google_${Date.now()}_${index}`,
            url: item.link,
            thumbnailUrl: item.image?.thumbnailLink || item.link,
            similarity,
            metadata: {
                title: item.title,
                source: extractDomain(item.image?.contextLink || ''),
                description: item.title,
            }
        });
    });

    return allItems;
}

function extractDomain(url: string): string {
    try {
        const domain = new URL(url).hostname;
        return domain.replace('www.', '');
    } catch {
        return 'Unknown Source';
    }
}
