use async_trait::async_trait;
use crate::ai::error::AIResult;
use crate::ai::types::{ChatCompletionRequest, ChatCompletionResponse, StreamChunk};

/// Trait for AI providers (OpenAI, Anthropic, etc.)
#[async_trait]
pub trait AIProvider: Send + Sync {
    /// Get provider name
    fn name(&self) -> &str;

    /// Check if provider supports streaming
    fn supports_streaming(&self) -> bool {
        false
    }

    /// Check if provider supports tools/function calling
    fn supports_tools(&self) -> bool {
        false
    }

    /// Downcast to Any for accessing provider-specific methods
    /// This allows accessing image generation, audio, and other provider-specific features
    #[allow(dead_code)]
    fn as_any(&self) -> &dyn std::any::Any;

    /// Send chat completion request
    async fn chat_completion(
        &self,
        request: ChatCompletionRequest,
    ) -> AIResult<ChatCompletionResponse>;

    /// Send streaming chat completion request
    /// Returns a stream of response chunks with content and metadata
    async fn chat_completion_stream(
        &self,
        request: ChatCompletionRequest,
    ) -> AIResult<Box<dyn futures::Stream<Item = AIResult<StreamChunk>> + Send + Unpin>> {
        // Default implementation for non-streaming providers
        let _ = request;
        Err(crate::ai::error::AIError::ProviderError(
            format!("{} does not support streaming", self.name())
        ))
    }
}
