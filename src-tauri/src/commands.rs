use crate::ai::{AIProxy, ChatCompletionRequest, ChatCompletionResponse, ModelInfo, ProviderCredentials};
use crate::audio::{AudioRecordingManager, AudioRecordingConfig, AudioRecordingSession, AudioRecordingResult};
use crate::local_models::{LocalModelManager, LocalModelStatus};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::collections::HashMap;
use tokio::sync::RwLock;
use tauri::{AppHandle, Emitter, State};
use reqwest::Client;
use futures::StreamExt;

/// Global state for AI Proxy and Audio
pub struct AppState {
    pub ai_proxy: Arc<AIProxy>,
    pub audio_manager: Arc<AudioRecordingManager>,
    /// Track active operations for abort functionality
    /// Key: sessionId/operationId, Value: abort flag
    pub active_operations: Arc<RwLock<HashMap<String, Arc<AtomicBool>>>>,
}

/// Helper to execute an async operation with abort flag and timeout support
async fn with_abort_and_timeout<F, T>(
    operations: Arc<RwLock<HashMap<String, Arc<AtomicBool>>>>,
    operation_id: String,
    timeout_secs: u64,
    timeout_message: &str,
    operation: F,
) -> Result<T, String>
where
    F: std::future::Future<Output = Result<T, String>>,
{
    // Register operation for abort capability
    let abort_flag = Arc::new(AtomicBool::new(false));
    {
        let mut ops = operations.write().await;
        ops.insert(operation_id.clone(), Arc::clone(&abort_flag));
    }

    // Race between operation, timeout, and abort
    let result = tokio::select! {
        res = operation => res,
        _ = tokio::time::sleep(tokio::time::Duration::from_secs(timeout_secs)) => {
            Err(timeout_message.to_string())
        }
        _ = async {
            loop {
                if abort_flag.load(Ordering::Relaxed) {
                    break;
                }
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }
        } => {
            Err("Operation aborted by user".to_string())
        }
    };

    // Cleanup operation
    {
        let mut ops = operations.write().await;
        ops.remove(&operation_id);
    }

    result
}

/// Main chat completion endpoint - credentials passed per-request
#[tauri::command]
pub async fn chat_completion(
    state: State<'_, AppState>,
    request: ChatCompletionRequest,
    operation_id: String,
    credentials: ProviderCredentials,
) -> Result<ChatCompletionResponse, String> {
    let proxy = Arc::clone(&state.ai_proxy);
    let operations = Arc::clone(&state.active_operations);

    with_abort_and_timeout(
        operations,
        operation_id,
        60,
        "Request timeout: AI provider did not respond within 60 seconds",
        async move {
            proxy.chat_completion(request, credentials)
                .await
                .map_err(|e| e.to_string())
        },
    ).await
}

/// Chat completion with streaming - credentials passed per-request
/// Emits events: "stream-chunk-{session_id}", "stream-done-{session_id}", "stream-error-{session_id}"
#[tauri::command]
pub async fn chat_completion_stream(
    app: AppHandle,
    state: State<'_, AppState>,
    request: ChatCompletionRequest,
    session_id: String,
    credentials: ProviderCredentials,
) -> Result<(), String> {
    let proxy = Arc::clone(&state.ai_proxy);
    let operations = Arc::clone(&state.active_operations);

    // Register this operation for abort capability
    let abort_flag = Arc::new(AtomicBool::new(false));
    {
        let mut ops = operations.write().await;
        ops.insert(session_id.clone(), Arc::clone(&abort_flag));
    }

    // Start streaming in a background task
    let session_id_clone = session_id.clone();
    let abort_flag_clone = Arc::clone(&abort_flag);
    tokio::spawn(async move {
        let chunk_event = format!("stream-chunk-{}", session_id);
        let done_event = format!("stream-done-{}", session_id);
        let error_event = format!("stream-error-{}", session_id);

        // Add timeout for getting the stream (30 seconds to establish connection)
        let stream_future = proxy.chat_completion_stream(request, credentials);
        let timeout_duration = tokio::time::Duration::from_secs(30);

        let stream_result = tokio::select! {
            result = stream_future => result,
            _ = tokio::time::sleep(timeout_duration) => {
                let _ = app.emit(&error_event, "Request timeout: Failed to establish connection to AI provider");
                let mut ops = operations.write().await;
                ops.remove(&session_id_clone);
                return;
            }
            _ = async {
                loop {
                    if abort_flag_clone.load(Ordering::Relaxed) {
                        break;
                    }
                    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                }
            } => {
                let _ = app.emit(&done_event, ());
                let mut ops = operations.write().await;
                ops.remove(&session_id_clone);
                return;
            }
        };

        // Get stream from proxy
        match stream_result {
            Ok(mut stream) => {
                // Stream chunks to frontend
                while let Some(result) = stream.next().await {
                    // Check abort flag
                    if abort_flag.load(Ordering::Relaxed) {
                        let _ = app.emit(&done_event, ()); // Emit done even if aborted (partial result is kept)
                        break;
                    }

                    match result {
                        Ok(chunk) => {
                            // Emit the full StreamChunk (includes content, citations, etc.)
                            // Frontend will extract what it needs
                            if let Err(_e) = app.emit(&chunk_event, &chunk) {
                                break;
                            }
                        }
                        Err(e) => {
                            let _ = app.emit(&error_event, format!("Stream error: {}", e));
                            // Cleanup operation on error
                            let mut ops = operations.write().await;
                            ops.remove(&session_id_clone);
                            return;
                        }
                    }
                }

                // Stream complete (either finished or aborted)
                let _ = app.emit(&done_event, ());

                // Cleanup operation
                let mut ops = operations.write().await;
                ops.remove(&session_id_clone);
            }
            Err(e) => {
                let _ = app.emit(&error_event, format!("Failed to start stream: {}", e));
                // Cleanup operation on error
                let mut ops = operations.write().await;
                ops.remove(&session_id_clone);
            }
        }
    });

    Ok(())
}

/// Fetch available models from a provider API
/// Works with any OpenAI-compatible API that has /v1/models endpoint
#[tauri::command]
pub async fn fetch_provider_models(
    api_key: String,
    base_url: String,
) -> Result<Vec<ModelInfo>, String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let url = format!("{}/models", base_url.trim_end_matches('/'));

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch models: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("API error ({}): {}", status, error_text));
    }

    #[derive(serde::Deserialize)]
    struct ModelsResponse {
        data: Vec<ModelInfo>,
    }

    let models_response: ModelsResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse models response: {}", e))?;

    Ok(models_response.data)
}

// ============================================================================
// AI Audio Commands
// ============================================================================

/// Transcribe audio - credentials passed per-request
#[tauri::command]
pub async fn transcribe_audio(
    state: State<'_, AppState>,
    operation_id: String,
    audio_data: Vec<u8>,
    model: String,
    language: Option<String>,
    prompt: Option<String>,
    credentials: ProviderCredentials,
) -> Result<String, String> {
    let request = crate::ai::types::AudioTranscriptionRequest {
        model: model.clone(),
        language,
        prompt,
        response_format: None, // Use default (verbose_json)
        temperature: None,
    };

    let proxy = Arc::clone(&state.ai_proxy);
    let operations = Arc::clone(&state.active_operations);

    with_abort_and_timeout(
        operations,
        operation_id,
        60,
        "Transcription timeout: Operation took longer than 60 seconds",
        async move {
            proxy.transcribe_audio(audio_data, request, credentials)
                .await
                .map(|r| r.text)
                .map_err(|e| e.to_string())
        },
    ).await
}

/// Generate speech from text - credentials passed per-request
#[tauri::command]
pub async fn text_to_speech(
    state: State<'_, AppState>,
    operation_id: String,
    text: String,
    model: String,
    voice: String,
    speed: Option<f32>,
    credentials: ProviderCredentials,
) -> Result<Vec<u8>, String> {
    let request = crate::ai::types::TextToSpeechRequest {
        model: model.clone(),
        input: text,
        voice,
        speed,
        response_format: None, // Use default (mp3)
    };

    let proxy = Arc::clone(&state.ai_proxy);
    let operations = Arc::clone(&state.active_operations);

    with_abort_and_timeout(
        operations,
        operation_id,
        60,
        "Text-to-speech timeout: Operation took longer than 60 seconds",
        async move {
            proxy.text_to_speech(request, credentials)
                .await
                .map_err(|e| e.to_string())
        },
    ).await
}

// ============================================================================
// Abort Operations
// ============================================================================

/// Abort an active AI operation (streaming, image generation, transcription, TTS)
/// This sets the abort flag for the given operation ID, causing it to stop gracefully
#[tauri::command]
pub async fn abort_operation(
    state: State<'_, AppState>,
    operation_id: String,
) -> Result<(), String> {
    let operations = state.active_operations.read().await;

    if let Some(abort_flag) = operations.get(&operation_id) {
        abort_flag.store(true, Ordering::Relaxed);
        Ok(())
    } else {
        // Operation not found - might have already completed
        // Return Ok anyway since the goal (stop operation) is achieved
        Ok(())
    }
}

// ============================================================================
// Keyboard Simulation Commands
// ============================================================================

/// Simulate paste action (Ctrl+V / Cmd+V) to paste clipboard content
/// at the current cursor position in any focused application
///
/// Note: On macOS, this uses AppleScript via osascript to avoid crashes
/// caused by enigo's TIS/TSM API calls from non-main threads.
/// On Windows/Linux, enigo is used directly.
/// Requires Accessibility permissions on macOS.
#[tauri::command]
pub async fn simulate_paste() -> Result<(), String> {
    // Small delay to ensure the window that should receive paste is focused
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    tokio::task::spawn_blocking(move || {
        simulate_paste_platform()
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[cfg(target_os = "macos")]
fn simulate_paste_platform() -> Result<(), String> {
    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg("tell application \"System Events\" to keystroke \"v\" using command down")
        .output()
        .map_err(|e| format!("Failed to execute osascript: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("osascript failed: {}", stderr));
    }

    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn simulate_paste_platform() -> Result<(), String> {
    use enigo::{Enigo, Keyboard, Settings, Key};

    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Failed to initialize enigo: {}", e))?;

    enigo.key(Key::Control, enigo::Direction::Press)
        .map_err(|e| format!("Failed to press modifier: {}", e))?;

    enigo.key(Key::Unicode('v'), enigo::Direction::Click)
        .map_err(|e| format!("Failed to press V: {}", e))?;

    enigo.key(Key::Control, enigo::Direction::Release)
        .map_err(|e| format!("Failed to release modifier: {}", e))?;

    Ok(())
}

// ============================================================================
// Audio Recording Commands
// ============================================================================

#[tauri::command]
pub async fn start_audio_recording(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    config: Option<AudioRecordingConfig>,
) -> Result<AudioRecordingSession, String> {
    state
        .audio_manager
        .start_recording(config, Some(app))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn stop_audio_recording(
    state: State<'_, AppState>,
    #[allow(non_snake_case)]
    sessionId: String,
) -> Result<AudioRecordingResult, String> {
    state
        .audio_manager
        .stop_recording(&sessionId)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cancel_audio_recording(
    state: State<'_, AppState>,
    #[allow(non_snake_case)]
    sessionId: String,
) -> Result<(), String> {
    state
        .audio_manager
        .cancel_recording(&sessionId)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reset_audio_recording(
    state: State<'_, AppState>,
) -> Result<bool, String> {
    Ok(state.audio_manager.force_reset())
}

// ============================================================================
// Local Model Commands
// ============================================================================

/// List all available local models with their download status
#[tauri::command]
pub async fn local_models_list(
    manager: State<'_, Arc<LocalModelManager>>,
) -> Result<Vec<LocalModelStatus>, String> {
    Ok(manager.list_models().await)
}

/// Download a local model by ID. Emits progress events: "local-model-download-progress-{model_id}"
#[tauri::command]
pub async fn local_model_download(
    app: AppHandle,
    manager: State<'_, Arc<LocalModelManager>>,
    model_id: String,
) -> Result<(), String> {
    let mgr = Arc::clone(&manager);
    let event_name = format!("local-model-download-progress-{}", model_id);
    let app_clone = app.clone();

    mgr.download_model(model_id, move |progress| {
        let _ = app_clone.emit(&event_name, progress);
    })
    .await
}

/// Delete a downloaded local model
#[tauri::command]
pub async fn local_model_delete(
    manager: State<'_, Arc<LocalModelManager>>,
    model_id: String,
) -> Result<(), String> {
    manager.delete_model(&model_id).await
}

/// Transcribe audio using a local whisper model
#[tauri::command]
pub async fn local_transcribe_audio(
    state: State<'_, AppState>,
    manager: State<'_, Arc<LocalModelManager>>,
    operation_id: String,
    audio_data: Vec<u8>,
    model_id: String,
    language: Option<String>,
) -> Result<String, String> {
    let mgr = Arc::clone(&manager);
    let operations = Arc::clone(&state.active_operations);

    with_abort_and_timeout(
        operations,
        operation_id,
        300,
        "Local transcription timeout: Operation took longer than 5 minutes",
        async move {
            let model_path = mgr
                .get_model_file_path(&model_id)
                .ok_or_else(|| format!("Model {} is not downloaded", model_id))?;

            // Run whisper inference on a blocking thread (CPU-bound)
            let lang = language;
            tokio::task::spawn_blocking(move || {
                crate::local_models::LocalWhisperEngine::transcribe(
                    &model_path,
                    &audio_data,
                    lang.as_deref(),
                )
            })
            .await
            .map_err(|e| format!("Whisper task failed: {}", e))?
        },
    )
    .await
}
