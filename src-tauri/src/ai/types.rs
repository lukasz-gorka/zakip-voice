use serde::{Deserialize, Serialize};

const MODEL_PROVIDER_SEPARATOR: &str = "::";

/// Extract the actual model ID from a composite ID (e.g., "openai::gpt-4" -> "gpt-4")
pub fn extract_model_id(composite_or_simple_id: &str) -> &str {
    if let Some(pos) = composite_or_simple_id.find(MODEL_PROVIDER_SEPARATOR) {
        &composite_or_simple_id[pos + MODEL_PROVIDER_SEPARATOR.len()..]
    } else {
        composite_or_simple_id
    }
}

/// Chat message role
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    System,
    User,
    Assistant,
    Tool,
}

/// Content can be text or array of content parts (for vision models)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum MessageContent {
    Text(String),
    Parts(Vec<ContentPart>),
}

/// Content part for multimodal messages
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentPart {
    Text { text: String },
    ImageUrl { image_url: ImageUrl },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageUrl {
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

/// Chat message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: Role,
    pub content: MessageContent,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
}

/// Tool call from model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub tool_type: String,
    pub function: FunctionCall,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionCall {
    pub name: String,
    pub arguments: String,
}

/// Tool definition (from MCP or manual)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    #[serde(rename = "type")]
    pub tool_type: String,
    pub function: ToolFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolFunction {
    pub name: String,
    pub description: Option<String>,
    pub parameters: serde_json::Value,
}

/// Chat completion request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<Tool>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_format: Option<ResponseFormat>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning_effort: Option<String>,
    #[serde(flatten)]
    pub extra_params: Option<serde_json::Map<String, serde_json::Value>>,
}

/// Response format for structured outputs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseFormat {
    #[serde(rename = "type")]
    pub format_type: String, // "json_object" or "text"
}

/// Chat completion response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionResponse {
    pub id: String,
    pub object: String,
    pub created: u64,
    pub model: String,
    pub choices: Vec<Choice>,
    pub usage: Usage,
    // Perplexity-specific fields
    #[serde(skip_serializing_if = "Option::is_none")]
    pub citations: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub search_results: Option<serde_json::Value>,
    // Catch-all for other unknown fields
    #[serde(flatten)]
    pub extra: Option<serde_json::Map<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Choice {
    pub index: u32,
    pub message: ChatMessage,
    pub finish_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Usage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
    // Perplexity-specific fields
    #[serde(skip_serializing_if = "Option::is_none")]
    pub search_context_size: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cost: Option<serde_json::Value>,
    // Catch-all for other unknown fields
    #[serde(flatten)]
    pub extra: Option<serde_json::Map<String, serde_json::Value>>,
}

/// Provider credentials passed per-request
/// Frontend sends these with each AI request - no server-side storage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCredentials {
    pub api_key: String,
    pub base_url: String,
}

/// Model info from provider API
/// Flexible struct that works with OpenAI, OpenRouter, and other compatible APIs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    /// OpenAI returns "model", OpenRouter doesn't include this field
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub object: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub owned_by: Option<String>,
    /// OpenRouter-specific: display name of the model
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// OpenRouter-specific: context length
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_length: Option<u64>,
}

/// Streaming response chunk from chat completion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionChunk {
    pub id: String,
    pub object: String,
    pub created: u64,
    pub model: String,
    pub choices: Vec<ChunkChoice>,
    // Perplexity and similar providers include these in final chunk
    #[serde(skip_serializing_if = "Option::is_none")]
    pub citations: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub search_results: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<Usage>,
    // Catch-all for other unknown fields
    #[serde(flatten)]
    pub extra: Option<serde_json::Map<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkChoice {
    pub index: u32,
    pub delta: ChunkDelta,
    pub finish_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkDelta {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
}

/// Data emitted during streaming - includes both content and metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamChunk {
    /// Text content for this chunk
    pub content: String,
    /// Citations (only present in final chunk from providers like Perplexity)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub citations: Option<Vec<String>>,
    /// Search results metadata (only present in final chunk)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub search_results: Option<serde_json::Value>,
    /// Token usage (only present in final chunk)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<Usage>,
}

// Image generation, audio transcription, and text-to-speech types
// These operations are now handled through Rust backend for security
// (no API keys exposed in browser)

/// Audio transcription request (OpenAI Whisper format)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioTranscriptionRequest {
    pub model: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>, // ISO-639-1 language code (e.g., "en", "pl")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt: Option<String>, // Optional text to guide the model's style
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_format: Option<String>, // "json", "text", "srt", "verbose_json", "vtt"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>, // Sampling temperature (0-1)
}

/// Audio transcription response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioTranscriptionResponse {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub words: Option<Vec<serde_json::Value>>, // Detailed word-level timestamps
    #[serde(skip_serializing_if = "Option::is_none")]
    pub segments: Option<Vec<serde_json::Value>>, // Detailed segment-level timestamps
}

/// Text-to-speech request (OpenAI TTS format)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextToSpeechRequest {
    pub model: String,
    pub input: String, // Text to convert to speech
    pub voice: String, // "alloy", "echo", "fable", "onyx", "nova", "shimmer"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speed: Option<f32>, // 0.25 to 4.0, default 1.0
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_format: Option<String>, // "mp3", "opus", "aac", "flac"
}
