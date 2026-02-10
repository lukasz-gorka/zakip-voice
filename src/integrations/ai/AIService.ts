import {AIServiceBackend} from "./AIServiceBackend.ts";

interface AudioTranscriptionOptions {
    providerId: string;
    model: string;
    language: string;
    prompt: string;
}

export class AIService {
    private _backend: AIServiceBackend;

    constructor(backend: AIServiceBackend) {
        this._backend = backend;
    }

    public audio = {
        transcribe: async (audioBlob: File | Blob, options: AudioTranscriptionOptions, operationId?: string) => {
            return this._backend.transcribeAudio(audioBlob, options, operationId);
        },
    };
}
