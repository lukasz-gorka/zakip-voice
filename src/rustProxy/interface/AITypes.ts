export interface ChatCompletionRequest {
    model: string;
    messages: any[];
    temperature?: number;
    max_tokens?: number;
    tools?: any[];
    tool_ids?: string[];
    stream?: boolean;
    response_format?: {type: "json_object" | "text"};
    reasoning_effort?: string;
}

export interface ChatCompletionResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: {
        index: number;
        message: any;
        finish_reason: string | null;
    }[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    citations?: string[];
    search_results?: any;
}

export interface AudioTranscriptionRequest {
    model: string;
    language?: string;
    prompt?: string;
}

export interface TextToSpeechRequest {
    model: string;
    text: string;
    voice: string;
    speed?: number;
}

export interface ProviderCredentials {
    api_key: string;
    base_url: string;
}
