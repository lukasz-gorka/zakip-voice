import {invoke} from "@tauri-apps/api/core";

export interface AudioRecordingSession {
    session_id: string;
    started_at: number;
    sample_rate: number;
    channels: number;
}

export interface AudioRecordingResult {
    session_id: string;
    duration_ms: number;
    audio_data: number[]; // WAV bytes
    sample_rate: number;
}

export interface AudioRecordingConfig {
    sample_rate?: number;
    channels?: number;
    echo_cancellation?: boolean;
    noise_suppression?: boolean;
    auto_gain_control?: boolean;
}

export async function startBackendRecording(config?: AudioRecordingConfig): Promise<AudioRecordingSession> {
    return invoke<AudioRecordingSession>("start_audio_recording", {config});
}

export async function stopBackendRecording(sessionId: string): Promise<AudioRecordingResult> {
    return invoke<AudioRecordingResult>("stop_audio_recording", {
        sessionId: sessionId,
    });
}

export async function cancelBackendRecording(sessionId: string): Promise<void> {
    return invoke<void>("cancel_audio_recording", {sessionId: sessionId});
}

export async function resetBackendRecording(): Promise<boolean> {
    return invoke<boolean>("reset_audio_recording");
}

export function audioResultToBlob(result: AudioRecordingResult): Blob {
    const uint8Array = new Uint8Array(result.audio_data);
    return new Blob([uint8Array], {type: "audio/wav"});
}
