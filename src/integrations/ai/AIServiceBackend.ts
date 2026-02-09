import {G} from "../../appInitializer/module/G.ts";
import {store} from "../../appInitializer/store";
import {Logger} from "../../logger/Logger.ts";
import {ProviderCredentials} from "../../rustProxy/types/AITypes.ts";
import {getRandomId} from "../../utils/dataGenerator.ts";
import {createCompositeModelId, parseModelId} from "./interface/AIModel.ts";
import {AIModelConfig} from "./interface/AIModelConfig.ts";
import {AIProviderConfig} from "./interface/AIProviderConfig.ts";
import {providersToModels} from "./ProvidersManager.ts";

export class AIServiceBackend {
    private getProviders(): AIProviderConfig[] {
        return store.getState().provider?.collection ?? [];
    }

    private getModels(): AIModelConfig[] {
        return providersToModels(this.getProviders());
    }

    private findModelConfig(compositeOrSimpleId: string): AIModelConfig | undefined {
        const models = this.getModels();
        const parsed = parseModelId(compositeOrSimpleId);

        if (parsed) {
            return models.find((m) => m.id === parsed.modelId && m.providerId === parsed.providerId);
        }

        return models.find((m) => m.id === compositeOrSimpleId);
    }

    private getCredentialsForModel(modelConfig: AIModelConfig): ProviderCredentials {
        const providers = this.getProviders();
        const provider = providers.find((p) => p.id === modelConfig.providerId);

        if (!provider) {
            throw new Error(`Provider not found for model: ${modelConfig.id}`);
        }

        return {
            api_key: provider.apiKey,
            base_url: provider.baseURL || "https://api.openai.com/v1",
        };
    }

    public async completion({
        messages,
        stream = false,
        model,
        tools,
        toolIds,
        responseFormat,
        reasoningEffort,
        additionalData,
        operationId,
    }: {
        messages: any[];
        stream?: boolean;
        model: string;
        tools?: any[];
        toolIds?: string[];
        responseFormat?: {type: "json_object" | "text"};
        reasoningEffort?: string;
        additionalData?: Record<string, any>;
        operationId?: string;
    }): Promise<any> {
        const modelConfig = this.findModelConfig(model);
        if (!modelConfig) {
            throw new Error(`Model not found: ${model}`);
        }

        if (!modelConfig.providerId) {
            throw new Error(`Model configuration error: Provider ID missing for model ${modelConfig.id}. Please refresh your provider settings.`);
        }

        const credentials = this.getCredentialsForModel(modelConfig);
        const compositeModelId = createCompositeModelId(modelConfig.providerId, modelConfig.id);

        const formattedMessages = messages.map((msg) => {
            let content;

            if (msg.content === null || msg.content === undefined) {
                content = "";
            } else if (typeof msg.content === "string") {
                content = msg.content;
            } else if (Array.isArray(msg.content)) {
                content = msg.content;
            } else {
                content = String(msg.content);
            }

            return {
                role: msg.role,
                content,
                name: msg.name,
                tool_call_id: msg.tool_call_id,
                tool_calls: msg.tool_calls,
            };
        });

        const request = {
            model: compositeModelId,
            messages: formattedMessages,
            temperature: undefined,
            max_tokens: undefined,
            tools: tools,
            tool_ids: toolIds,
            stream: stream ? true : undefined,
            response_format: responseFormat ? {type: responseFormat.type} : undefined,
            reasoning_effort: reasoningEffort,
            ...additionalData,
        };

        try {
            const opId = operationId || getRandomId();
            const response = await G.rustProxy.chatCompletion(request, opId, credentials);
            return response;
        } catch (error) {
            Logger.error("AI Request failed", {
                console: true,
                error,
                data: {
                    model,
                    baseURL: credentials.base_url,
                    errorMessage: error instanceof Error ? error.message : String(error),
                },
            });

            throw new Error(`AI completion failed: ${error}`);
        }
    }

    public async completionStream({
        messages,
        model,
        tools,
        toolIds,
        responseFormat,
        reasoningEffort,
        additionalData,
        onChunk,
        onMetadata,
        onDone,
        onError,
    }: {
        messages: any[];
        model: string;
        tools?: any[];
        toolIds?: string[];
        responseFormat?: {type: "json_object" | "text"};
        reasoningEffort?: string;
        additionalData?: Record<string, any>;
        onChunk: (chunk: string) => void;
        onMetadata?: (metadata: {citations?: string[]; searchResults?: any; usage?: any}) => void;
        onDone: () => void;
        onError: (error: string) => void;
    }): Promise<{sessionId: string}> {
        const modelConfig = this.findModelConfig(model);
        if (!modelConfig) {
            throw new Error(`Model not found: ${model}`);
        }

        if (!modelConfig.providerId) {
            throw new Error(`Model configuration error: Provider ID missing for model ${modelConfig.id}. Please refresh your provider settings.`);
        }

        const credentials = this.getCredentialsForModel(modelConfig);
        const compositeModelId = createCompositeModelId(modelConfig.providerId, modelConfig.id);

        const formattedMessages = messages.map((msg) => {
            let content;

            if (msg.content === null || msg.content === undefined) {
                content = "";
            } else if (typeof msg.content === "string") {
                content = msg.content;
            } else if (Array.isArray(msg.content)) {
                content = msg.content;
            } else {
                content = String(msg.content);
            }

            return {
                role: msg.role,
                content,
                name: msg.name,
                tool_call_id: msg.tool_call_id,
                tool_calls: msg.tool_calls,
            };
        });

        const request = {
            model: compositeModelId,
            messages: formattedMessages,
            temperature: undefined,
            max_tokens: undefined,
            tools: tools,
            tool_ids: toolIds,
            stream: true,
            response_format: responseFormat ? {type: responseFormat.type} : undefined,
            reasoning_effort: reasoningEffort,
            ...additionalData,
        };

        const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

        try {
            await G.rustProxy.chatCompletionStream(request, sessionId, credentials, {
                onChunk: (chunk: string) => {
                    onChunk(chunk);
                },
                onMetadata: (metadata) => {
                    if (onMetadata) {
                        onMetadata(metadata);
                    }
                },
                onDone: () => {
                    onDone();
                },
                onError: (errorMessage: string) => {
                    Logger.error("AI Stream Request failed", {
                        console: true,
                        data: {
                            model,
                            baseURL: credentials.base_url,
                            errorMessage,
                        },
                    });
                    onError(errorMessage);
                },
            });
            return {sessionId};
        } catch (error) {
            Logger.error("AI Stream failed to start", {
                console: true,
                error,
                data: {
                    model,
                    baseURL: credentials.base_url,
                    errorMessage: error instanceof Error ? error.message : String(error),
                },
            });

            throw new Error(`Failed to start stream: ${error}`);
        }
    }

    public async transcribeAudio(
        audioFile: File | Blob,
        options: {
            providerId: string;
            model: string;
            language: string;
            prompt: string;
        },
        operationId?: string,
    ): Promise<{text: string; operationId: string}> {
        const opId = operationId || getRandomId();

        // Handle local model transcription
        if (options.providerId === "local") {
            try {
                const arrayBuffer = await audioFile.arrayBuffer();
                const audioData = new Uint8Array(arrayBuffer);
                const language = options.language?.split("-")[0];

                const transcription = await G.rustProxy.localTranscribeAudio(opId, audioData, options.model, language);
                return {
                    text: transcription,
                    operationId: opId,
                };
            } catch (error) {
                Logger.error("[AIServiceBackend] Local audio transcription failed", {error});
                throw new Error(`Local audio transcription failed: ${error}`);
            }
        }

        const providerId = options.providerId.toLowerCase();
        const models = this.getModels();

        // Find model config by matching both model ID and provider ID
        const modelConfig = models.find((model) => model.visible && model.id === options.model && model.providerId?.toLowerCase() === providerId);

        if (!modelConfig) {
            throw new Error(`Audio transcription model not found: ${options.model} for provider ${options.providerId}`);
        }

        if (!modelConfig.providerId) {
            throw new Error(`Model configuration error: Provider ID missing for model ${modelConfig.id}. Please refresh your provider settings.`);
        }

        const credentials = this.getCredentialsForModel(modelConfig);
        const compositeModelId = createCompositeModelId(modelConfig.providerId, modelConfig.id);

        try {
            const arrayBuffer = await audioFile.arrayBuffer();
            const audioData = new Uint8Array(arrayBuffer);

            const transcription = await G.rustProxy.transcribeAudio(
                opId,
                audioData,
                {
                    model: compositeModelId,
                    language: options.language.split("-")[0],
                    prompt: options.prompt,
                },
                credentials,
            );

            return {
                text: transcription,
                operationId: opId,
            };
        } catch (error) {
            Logger.error("[AIServiceBackend] Audio transcription failed", {error});
            throw new Error(`Audio transcription failed: ${error}`);
        }
    }

    public async textToSpeech(
        text: string,
        options: {
            providerId: string;
            model: string;
            voice: string;
            speed: number;
        },
        operationId?: string,
    ): Promise<{audio: ArrayBuffer; operationId: string}> {
        options.providerId = "openai";

        const providerId = options.providerId.toLowerCase();
        const models = this.getModels();

        const modelConfig = models.find((model) => model.visible && model.id === options.model && model.providerName?.toLowerCase() === providerId);

        if (!modelConfig) {
            throw new Error(`Text-to-speech model not found: ${options.model} for provider ${options.providerId}`);
        }

        if (!modelConfig.providerId) {
            throw new Error(`Model configuration error: Provider ID missing for model ${modelConfig.id}. Please refresh your provider settings.`);
        }

        const credentials = this.getCredentialsForModel(modelConfig);
        const opId = operationId || getRandomId();
        const compositeModelId = createCompositeModelId(modelConfig.providerId, modelConfig.id);

        try {
            const audioData = await G.rustProxy.textToSpeech(
                opId,
                {
                    text,
                    model: compositeModelId,
                    voice: options.voice,
                    speed: options.speed,
                },
                credentials,
            );

            const buffer = audioData.buffer;

            const audioBuffer = buffer instanceof ArrayBuffer ? buffer : (audioData.buffer.slice(0) as ArrayBuffer);

            return {
                audio: audioBuffer,
                operationId: opId,
            };
        } catch (error) {
            Logger.error("[AIServiceBackend] Text-to-speech failed", {error});
            throw new Error(`Text-to-speech failed: ${error}`);
        }
    }
}
