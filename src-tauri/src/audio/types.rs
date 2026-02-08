use serde::{Deserialize, Serialize};

/// Configuration for audio recording
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AudioRecordingConfig {
    /// Sample rate in Hz (default: 48000 for webrtc compatibility)
    pub sample_rate: u32,
    /// Number of channels (default: 1 for mono)
    pub channels: u16,
    /// Enable echo cancellation
    pub echo_cancellation: bool,
    /// Enable noise suppression
    pub noise_suppression: bool,
    /// Enable automatic gain control
    pub auto_gain_control: bool,
}

impl Default for AudioRecordingConfig {
    fn default() -> Self {
        Self {
            sample_rate: 48000,
            channels: 1,
            echo_cancellation: true,
            noise_suppression: true,
            auto_gain_control: true,
        }
    }
}

/// Information about an active recording session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioRecordingSession {
    /// Unique session identifier
    pub session_id: String,
    /// Timestamp when recording started (Unix epoch ms)
    pub started_at: u64,
    /// Sample rate being used
    pub sample_rate: u32,
    /// Number of channels
    pub channels: u16,
}

/// Result of a completed recording
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioRecordingResult {
    /// Session identifier
    pub session_id: String,
    /// Duration of recording in milliseconds
    pub duration_ms: u64,
    /// WAV audio data as bytes
    pub audio_data: Vec<u8>,
    /// Sample rate of the audio
    pub sample_rate: u32,
}

/// Error types for audio recording
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AudioRecordingError {
    /// No audio input device available
    NoInputDevice,
    /// Failed to initialize audio stream
    StreamInitFailed(String),
    /// No active recording session
    NoActiveSession,
    /// Session ID mismatch
    SessionMismatch,
    /// Audio processing error
    ProcessingError(String),
    /// WAV encoding error
    EncodingError(String),
}

impl std::fmt::Display for AudioRecordingError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NoInputDevice => write!(f, "No audio input device available"),
            Self::StreamInitFailed(msg) => write!(f, "Failed to initialize audio stream: {}", msg),
            Self::NoActiveSession => write!(f, "No active recording session"),
            Self::SessionMismatch => write!(f, "Session ID does not match active recording"),
            Self::ProcessingError(msg) => write!(f, "Audio processing error: {}", msg),
            Self::EncodingError(msg) => write!(f, "WAV encoding error: {}", msg),
        }
    }
}

impl std::error::Error for AudioRecordingError {}
