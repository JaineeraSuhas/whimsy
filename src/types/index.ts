
export interface ImageData {
    id: string;
    url: string;
    thumbnailUrl: string;
    similarity: number;
    metadata?: {
        title?: string;
        source?: string;
        date?: string;
        tags?: string[];
        description?: string;
    };
}
