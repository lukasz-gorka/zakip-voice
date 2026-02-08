use thiserror::Error;

#[derive(Error, Debug)]
pub enum AIError {
    #[error("Provider error: {0}")]
    ProviderError(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),
}

impl From<serde_json::Error> for AIError {
    fn from(err: serde_json::Error) -> Self {
        AIError::SerializationError(err.to_string())
    }
}

impl From<reqwest::Error> for AIError {
    fn from(err: reqwest::Error) -> Self {
        AIError::NetworkError(err.to_string())
    }
}

pub type AIResult<T> = Result<T, AIError>;
