import {invoke} from "@tauri-apps/api/core";
import {listen} from "@tauri-apps/api/event";
import {Logger} from "../logger/Logger.ts";
import type {AudioTranscriptionRequest, ChatCompletionRequest, ChatCompletionResponse, ProviderCredentials, TextToSpeechRequest} from "./types/AITypes.ts";
import type {LocalModelStatus} from "./types/LocalModelTypes.ts";

export class RustProxyModule {
    public async chatCompletion(request: ChatCompletionRequest, operationId: string, credentials: ProviderCredentials): Promise<ChatCompletionResponse> {
        try {
            Logger.debug("[RustProxy] chatCompletion", {
                data: {
                    model: request.model,
                    messagesCount: request.messages.length,
                    operationId,
                },
            });

            return await invoke<ChatCompletionResponse>("chat_completion", {request, operationId, credentials});
        } catch (error) {
            Logger.error("[RustProxy] chatCompletion failed", {error});
            throw new Error(`Chat completion failed: ${error}`);
        }
    }

    public async chatCompletionStream(
        request: ChatCompletionRequest,
        sessionId: string,
        credentials: ProviderCredentials,
        callbacks: {
            onChunk: (chunk: string) => void;
            onMetadata?: (metadata: {citations?: string[]; searchResults?: any; usage?: any}) => void;
            onDone: () => void;
            onError: (error: string) => void;
        },
    ): Promise<() => void> {
        try {
            Logger.debug("[RustProxy] chatCompletionStream", {
                data: {
                    model: request.model,
                    sessionId,
                },
            });

            const chunkUnlisten = await listen<{content: string; citations?: string[]; search_results?: never; usage?: never}>(`stream-chunk-${sessionId}`, (event) => {
                const {content, citations, search_results, usage} = event.payload;

                if (content) {
                    callbacks.onChunk(content);
                }

                if ((citations || search_results || usage) && callbacks.onMetadata) {
                    callbacks.onMetadata({
                        citations,
                        searchResults: search_results,
                        usage,
                    });
                }
            });

            const doneUnlisten = await listen(`stream-done-${sessionId}`, () => {
                chunkUnlisten();
                doneUnlisten();
                errorUnlisten();
                callbacks.onDone();
            });

            const errorUnlisten = await listen<string>(`stream-error-${sessionId}`, (event) => {
                chunkUnlisten();
                doneUnlisten();
                errorUnlisten();
                callbacks.onError(event.payload);
            });

            await invoke("chat_completion_stream", {
                request,
                sessionId,
                credentials,
            });

            return () => {
                chunkUnlisten();
                doneUnlisten();
                errorUnlisten();
            };
        } catch (error) {
            Logger.error("[RustProxy] chatCompletionStream failed", {error});
            throw new Error(`Stream failed to start: ${error}`);
        }
    }

    public async transcribeAudio(operationId: string, audioData: Uint8Array, request: AudioTranscriptionRequest, credentials: ProviderCredentials): Promise<string> {
        try {
            Logger.debug("[RustProxy] transcribeAudio", {
                data: {
                    model: request.model,
                    audioSize: audioData.length,
                    operationId,
                },
            });

            const audioArray = Array.from(audioData);

            return await invoke<string>("transcribe_audio", {
                operationId,
                audioData: audioArray,
                model: request.model,
                language: request.language,
                prompt: request.prompt,
                credentials,
            });
        } catch (error) {
            Logger.error("[RustProxy] transcribeAudio failed", {error});
            throw new Error(`Audio transcription failed: ${error}`);
        }
    }

    public async textToSpeech(operationId: string, request: TextToSpeechRequest, credentials: ProviderCredentials): Promise<Uint8Array> {
        try {
            Logger.debug("[RustProxy] textToSpeech", {
                data: {
                    model: request.model,
                    textLength: request.text.length,
                    operationId,
                },
            });

            const response = await invoke<number[]>("text_to_speech", {
                operationId,
                text: request.text,
                model: request.model,
                voice: request.voice,
                speed: request.speed,
                credentials,
            });

            return new Uint8Array(response);
        } catch (error) {
            Logger.error("[RustProxy] textToSpeech failed", {error});
            throw new Error(`Text-to-speech failed: ${error}`);
        }
    }

    public async abortOperation(operationId: string): Promise<void> {
        try {
            await invoke("abort_operation", {operationId});
        } catch (error) {
            Logger.error("[RustProxy] abortOperation failed", {error});
        }
    }

    // ========================================================================
    // Local Model Commands
    // ========================================================================

    public async localModelsList(): Promise<LocalModelStatus[]> {
        try {
            return await invoke<LocalModelStatus[]>("local_models_list");
        } catch (error) {
            Logger.error("[RustProxy] localModelsList failed", {error});
            throw new Error(`Failed to list local models: ${error}`);
        }
    }

    public async localModelDownload(modelId: string, onProgress: (progress: number) => void): Promise<void> {
        const unlisten = await listen<number>(`local-model-download-progress-${modelId}`, (event) => {
            onProgress(event.payload);
        });

        try {
            await invoke("local_model_download", {modelId});
        } finally {
            unlisten();
        }
    }

    public async localModelDelete(modelId: string): Promise<void> {
        try {
            await invoke("local_model_delete", {modelId});
        } catch (error) {
            Logger.error("[RustProxy] localModelDelete failed", {error});
            throw new Error(`Failed to delete model: ${error}`);
        }
    }

    public async localTranscribeAudio(operationId: string, audioData: Uint8Array, modelId: string, language?: string): Promise<string> {
        try {
            Logger.debug("[RustProxy] localTranscribeAudio", {
                data: {modelId, audioSize: audioData.length, operationId},
            });

            const audioArray = Array.from(audioData);

            return await invoke<string>("local_transcribe_audio", {
                operationId,
                audioData: audioArray,
                modelId,
                language,
            });
        } catch (error) {
            Logger.error("[RustProxy] localTranscribeAudio failed", {error});
            throw new Error(`Local transcription failed: ${error}`);
        }
    }
}
