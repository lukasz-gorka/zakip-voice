import {DEFAULT_ENHANCEMENT_PROMPT} from "../const/TRANSCRIPTION_ENHANCEMENT_PROMPT.ts";

export interface SpeechToTextSettings {
    providerId: string;
    model: string;
    language: string;
    prompt: string;
    globalShortcut: string;
    globalShortcutWithAI: string;
    globalShortcutToggleApp: string;
    globalShortcutAbort: string;
    enhancementPrompt: string;
    enhancementProviderId: string;
    enhancementModel: string;
    copyToClipboard: boolean;
    autoPasteAfterTranscription: boolean;
    playSoundNotification: boolean;
    enableEscapeShortcut: boolean;
}

export interface TranscriptionHistoryItem {
    id: string;
    text: string;
    timestamp: number;
    rawText?: string;
    isEnhanced?: boolean;
    modelName?: string;
}

export interface IVoiceSettings {
    speechToText: SpeechToTextSettings;
    transcriptionHistory: TranscriptionHistoryItem[];
    isRecording?: boolean;
    isTranscribing?: boolean;
    isEnhancing?: boolean;
    enableAIEnhancement?: boolean;
    recordingStartTime?: number;
    transcribingStartTime?: number;
    enhancingStartTime?: number;
}

export const DEFAULT_VOICE_SETTINGS: IVoiceSettings = {
    speechToText: {
        providerId: "openai",
        model: "gpt-4o-mini-transcribe",
        language: "pl-PL",
        prompt: "",
        globalShortcut: "",
        globalShortcutWithAI: "",
        globalShortcutToggleApp: "",
        globalShortcutAbort: "",
        enhancementPrompt: DEFAULT_ENHANCEMENT_PROMPT,
        enhancementProviderId: "",
        enhancementModel: "",
        copyToClipboard: true,
        autoPasteAfterTranscription: false,
        playSoundNotification: true,
        enableEscapeShortcut: true,
    },
    transcriptionHistory: [],
    isRecording: false,
    isEnhancing: false,
    enableAIEnhancement: true,
};
