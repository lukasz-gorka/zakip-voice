use crate::audio::types::*;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use std::thread::{self, JoinHandle};
use std::sync::mpsc::{self, Sender, Receiver};
use tauri::Emitter;

/// Commands sent to the audio thread
enum AudioCommand {
    StartRecording {
        config: AudioRecordingConfig,
        app_handle: Option<tauri::AppHandle>,
        response: Sender<Result<AudioRecordingSession, AudioRecordingError>>,
    },
    StopRecording {
        session_id: String,
        response: Sender<Result<AudioRecordingResult, AudioRecordingError>>,
    },
    CancelRecording {
        session_id: String,
        response: Sender<Result<(), AudioRecordingError>>,
    },
    ForceReset {
        response: Sender<bool>,
    },
    Shutdown,
}

/// Uses a dedicated thread for audio operations since cpal::Stream is not Send
pub struct AudioRecordingManager {
    command_sender: Sender<AudioCommand>,
    _audio_thread: JoinHandle<()>,
}

// Implement Send + Sync manually since we only send commands through channels
unsafe impl Send for AudioRecordingManager {}
unsafe impl Sync for AudioRecordingManager {}

impl AudioRecordingManager {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::channel();

        let audio_thread = thread::spawn(move || {
            audio_thread_main(rx);
        });

        Self {
            command_sender: tx,
            _audio_thread: audio_thread,
        }
    }

    /// Start a new audio recording session
    pub fn start_recording(&self, config: Option<AudioRecordingConfig>, app_handle: Option<tauri::AppHandle>) -> Result<AudioRecordingSession, AudioRecordingError> {
        let (tx, rx) = mpsc::channel();
        self.command_sender.send(AudioCommand::StartRecording {
            config: config.unwrap_or_default(),
            app_handle,
            response: tx,
        }).map_err(|_| AudioRecordingError::StreamInitFailed("Audio thread not responding".to_string()))?;

        rx.recv().map_err(|_| AudioRecordingError::StreamInitFailed("Audio thread not responding".to_string()))?
    }

    /// Stop the current recording and return WAV data
    pub fn stop_recording(&self, session_id: &str) -> Result<AudioRecordingResult, AudioRecordingError> {
        let (tx, rx) = mpsc::channel();
        self.command_sender.send(AudioCommand::StopRecording {
            session_id: session_id.to_string(),
            response: tx,
        }).map_err(|_| AudioRecordingError::StreamInitFailed("Audio thread not responding".to_string()))?;

        rx.recv().map_err(|_| AudioRecordingError::StreamInitFailed("Audio thread not responding".to_string()))?
    }

    /// Cancel the current recording without returning data
    pub fn cancel_recording(&self, session_id: &str) -> Result<(), AudioRecordingError> {
        let (tx, rx) = mpsc::channel();
        self.command_sender.send(AudioCommand::CancelRecording {
            session_id: session_id.to_string(),
            response: tx,
        }).map_err(|_| AudioRecordingError::StreamInitFailed("Audio thread not responding".to_string()))?;

        rx.recv().map_err(|_| AudioRecordingError::StreamInitFailed("Audio thread not responding".to_string()))?
    }

    pub fn force_reset(&self) -> bool {
        let (tx, rx) = mpsc::channel();
        if self.command_sender.send(AudioCommand::ForceReset { response: tx }).is_ok() {
            rx.recv().unwrap_or(false)
        } else {
            false
        }
    }
}

impl Drop for AudioRecordingManager {
    fn drop(&mut self) {
        let _ = self.command_sender.send(AudioCommand::Shutdown);
    }
}

/// Internal state for an active recording (lives in audio thread)
struct RecordingState {
    session: AudioRecordingSession,
    samples: Arc<Mutex<Vec<f32>>>,
    stream: cpal::Stream,
    app_handle: Option<tauri::AppHandle>,
}

/// Main function for the audio thread
fn audio_thread_main(receiver: Receiver<AudioCommand>) {
    let mut active_recording: Option<RecordingState> = None;

    loop {
        match receiver.recv() {
            Ok(command) => match command {
                AudioCommand::StartRecording { config, app_handle, response } => {
                    let result = start_recording_internal(&mut active_recording, config, app_handle);
                    let _ = response.send(result);
                }
                AudioCommand::StopRecording { session_id, response } => {
                    let result = stop_recording_internal(&mut active_recording, &session_id);
                    let _ = response.send(result);
                }
                AudioCommand::CancelRecording { session_id, response } => {
                    let result = cancel_recording_internal(&mut active_recording, &session_id);
                    let _ = response.send(result);
                }
                AudioCommand::ForceReset { response } => {
                    let had_recording = active_recording.is_some();
                    if had_recording {
                        if let Some(state) = active_recording.take() {
                            drop(state.stream);
                            eprintln!("[AudioRecorder] Force reset: cleared stuck recording session");
                        }
                    }
                    let _ = response.send(had_recording);
                }
                AudioCommand::Shutdown => {
                    eprintln!("[AudioRecorder] Shutting down audio thread");
                    break;
                }
            },
            Err(_) => {
                // Channel closed, exit thread
                break;
            }
        }
    }
}

fn start_recording_internal(
    active_recording: &mut Option<RecordingState>,
    config: AudioRecordingConfig,
    app_handle: Option<tauri::AppHandle>,
) -> Result<AudioRecordingSession, AudioRecordingError> {
    // Check if already recording
    if active_recording.is_some() {
        return Err(AudioRecordingError::StreamInitFailed(
            "Recording already in progress".to_string(),
        ));
    }

    // Get default audio input device
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or(AudioRecordingError::NoInputDevice)?;

    eprintln!("[AudioRecorder] Using input device: {:?}", device.name());

    // Get supported config - prefer our target sample rate
    let supported_config = device
        .supported_input_configs()
        .map_err(|e| AudioRecordingError::StreamInitFailed(e.to_string()))?
        .find(|c| {
            c.channels() == config.channels
                && c.min_sample_rate().0 <= config.sample_rate
                && c.max_sample_rate().0 >= config.sample_rate
        })
        .or_else(|| {
            // Fallback to any mono config
            device
                .supported_input_configs()
                .ok()?
                .find(|c| c.channels() == 1)
        })
        .or_else(|| {
            // Fallback to any config
            device
                .supported_input_configs()
                .ok()?
                .next()
        })
        .ok_or_else(|| {
            AudioRecordingError::StreamInitFailed("No suitable audio config found".to_string())
        })?;

    let sample_rate = if supported_config.min_sample_rate().0 <= config.sample_rate
        && supported_config.max_sample_rate().0 >= config.sample_rate
    {
        config.sample_rate
    } else {
        supported_config.max_sample_rate().0.min(48000)
    };

    let stream_config = supported_config
        .with_sample_rate(cpal::SampleRate(sample_rate))
        .config();

    eprintln!(
        "[AudioRecorder] Stream config: {} Hz, {} channels",
        stream_config.sample_rate.0, stream_config.channels
    );

    // Create session info
    let session_id = format!("rec-{}", uuid_simple());
    let started_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let session = AudioRecordingSession {
        session_id: session_id.clone(),
        started_at,
        sample_rate: stream_config.sample_rate.0,
        channels: stream_config.channels,
    };

    // Shared buffer for samples
    let samples_buffer: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::new()));
    let samples_buffer_clone = Arc::clone(&samples_buffer);
    let channels = stream_config.channels as usize;

    // For audio level events
    let app_handle_clone = app_handle.clone();
    let session_id_clone = session_id.clone();
    let last_emit_time = Arc::new(Mutex::new(std::time::Instant::now()));

    // Create audio stream
    let err_fn = |err| eprintln!("[AudioRecorder] Stream error: {}", err);

    let stream = device
        .build_input_stream(
            &stream_config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                // Handle poisoned mutex gracefully
                let mut buffer = match samples_buffer_clone.lock() {
                    Ok(guard) => guard,
                    Err(poisoned) => {
                        eprintln!("[AudioRecorder] WARNING: Mutex was poisoned, recovering...");
                        poisoned.into_inner()
                    }
                };

                // Calculate RMS level for visualization
                let rms = if !data.is_empty() {
                    let sum_of_squares: f32 = data.iter().map(|&s| s * s).sum();
                    (sum_of_squares / data.len() as f32).sqrt()
                } else {
                    0.0
                };

                // Emit audio level event every ~50ms
                if let Some(app) = &app_handle_clone {
                    let mut last_time = last_emit_time.lock().unwrap();
                    if last_time.elapsed().as_millis() >= 50 {
                        let _ = app.emit("audio-level", serde_json::json!({
                            "sessionId": session_id_clone,
                            "level": rms,
                        }));
                        *last_time = std::time::Instant::now();
                    }
                }

                // If stereo, convert to mono by averaging channels
                if channels > 1 {
                    for chunk in data.chunks(channels) {
                        let mono_sample: f32 = chunk.iter().sum::<f32>() / channels as f32;
                        buffer.push(mono_sample);
                    }
                } else {
                    buffer.extend_from_slice(data);
                }
            },
            err_fn,
            None,
        )
        .map_err(|e| AudioRecordingError::StreamInitFailed(e.to_string()))?;

    // Start the stream
    stream
        .play()
        .map_err(|e| AudioRecordingError::StreamInitFailed(e.to_string()))?;

    eprintln!("[AudioRecorder] Recording started: {}", session_id);

    // Store recording state
    *active_recording = Some(RecordingState {
        session: session.clone(),
        samples: samples_buffer,
        stream,
        app_handle,
    });

    Ok(session)
}

fn stop_recording_internal(
    active_recording: &mut Option<RecordingState>,
    session_id: &str,
) -> Result<AudioRecordingResult, AudioRecordingError> {
    let state = active_recording.take().ok_or(AudioRecordingError::NoActiveSession)?;

    // Verify session ID matches
    if state.session.session_id != session_id {
        // Put it back
        *active_recording = Some(state);
        return Err(AudioRecordingError::SessionMismatch);
    }

    // Stream is dropped here, stopping recording
    drop(state.stream);

    let duration_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
        - state.session.started_at;

    // Get the collected samples
    let samples = {
        let guard = match state.samples.lock() {
            Ok(guard) => guard,
            Err(poisoned) => {
                eprintln!("[AudioRecorder] WARNING: Mutex was poisoned during stop, recovering...");
                poisoned.into_inner()
            }
        };
        guard.clone()
    };

    eprintln!(
        "[AudioRecorder] Recording stopped: {}, duration: {}ms, samples: {}",
        session_id,
        duration_ms,
        samples.len()
    );

    // Convert to WAV (mono output)
    let audio_data = encode_wav(&samples, state.session.sample_rate, 1)?;

    Ok(AudioRecordingResult {
        session_id: session_id.to_string(),
        duration_ms,
        audio_data,
        sample_rate: state.session.sample_rate,
    })
}

fn cancel_recording_internal(
    active_recording: &mut Option<RecordingState>,
    session_id: &str,
) -> Result<(), AudioRecordingError> {
    let state = active_recording.take().ok_or(AudioRecordingError::NoActiveSession)?;

    if state.session.session_id != session_id {
        *active_recording = Some(state);
        return Err(AudioRecordingError::SessionMismatch);
    }

    drop(state.stream);
    eprintln!("[AudioRecorder] Recording cancelled: {}", session_id);

    Ok(())
}

/// Encode samples as WAV
fn encode_wav(
    samples: &[f32],
    sample_rate: u32,
    channels: u16,
) -> Result<Vec<u8>, AudioRecordingError> {
    let spec = hound::WavSpec {
        channels,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut cursor = std::io::Cursor::new(Vec::new());
    {
        let mut writer = hound::WavWriter::new(&mut cursor, spec)
            .map_err(|e| AudioRecordingError::EncodingError(e.to_string()))?;

        for &sample in samples {
            // Convert f32 [-1.0, 1.0] to i16
            let sample_i16 = (sample * 32767.0).clamp(-32768.0, 32767.0) as i16;
            writer
                .write_sample(sample_i16)
                .map_err(|e| AudioRecordingError::EncodingError(e.to_string()))?;
        }

        writer
            .finalize()
            .map_err(|e| AudioRecordingError::EncodingError(e.to_string()))?;
    }

    Ok(cursor.into_inner())
}

/// Generate a simple UUID-like string
fn uuid_simple() -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("{:x}", timestamp)
}
