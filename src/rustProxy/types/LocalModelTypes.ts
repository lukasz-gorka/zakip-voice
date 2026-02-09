export interface LocalModelStatus {
    id: string;
    name: string;
    category: "speech-to-text";
    description: string;
    size_mb: number;
    downloaded: boolean;
    downloading: boolean;
    download_progress: number;
}
