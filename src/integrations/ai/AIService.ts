import {AIServiceBackend} from "./AIServiceBackend.ts";

interface TextCompletionOptions {
    messages: any[];
    model: string;
    stream?: boolean;
    tools?: any[];
    toolIds?: string[];
    responseFormat?: {type: "json_object" | "text"};
    reasoningEffort?: string;
    additionalData?: Record<string, any>;
}

interface TextCompletionStreamOptions extends Omit<TextCompletionOptions, "stream"> {
    onChunk: (chunk: string) => void;
    onMetadata?: (metadata: {citations?: string[]; searchResults?: any; usage?: any}) => void;
    onDone: () => void;
    onError: (error: string) => void;
}

interface AudioTranscriptionOptions {
    providerId: string;
    model: string;
    language: string;
    prompt: string;
}

interface TextToSpeechOptions {
    providerId: string;
    model: string;
    voice: string;
    speed: number;
}

export class AIService {
    private _backend: AIServiceBackend;

    constructor(backend: AIServiceBackend) {
        this._backend = backend;
    }

    public text = {
        complete: async (options: TextCompletionOptions) => {
            return this._backend.completion(options);
        },
        stream: async (options: TextCompletionStreamOptions) => {
            return this._backend.completionStream(options);
        },
    };

    public audio = {
        transcribe: async (audioBlob: File | Blob, options: AudioTranscriptionOptions, operationId?: string) => {
            return this._backend.transcribeAudio(audioBlob, options, operationId);
        },
        speak: async (text: string, options: TextToSpeechOptions, operationId?: string) => {
            const {audio: arrayBuffer} = await this._backend.textToSpeech(text, options, operationId);

            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);

            return new Promise<void>((resolve, reject) => {
                source.onended = () => {
                    audioContext.close();
                    resolve();
                };

                try {
                    source.start(0);
                } catch (error) {
                    audioContext.close();
                    reject(error);
                }
            });
        },
        getRawAudio: async (text: string, options: TextToSpeechOptions, operationId?: string) => {
            return this._backend.textToSpeech(text, options, operationId);
        },
    };
    public get backend(): AIServiceBackend {
        return this._backend;
    }
}
