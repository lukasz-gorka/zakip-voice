import {StoreManager} from "../../appInitializer/store/StoreManager.ts";
import {TranscriptionHistoryItem} from "../interfaces/IVoiceSettings.ts";

export class VoiceStoreManager extends StoreManager<"voice"> {
    constructor() {
        super("voice");
    }

    public addTranscriptionToHistory = (transcription: TranscriptionHistoryItem) => {
        this.updateState((voice) => ({
            ...voice,
            transcriptionHistory: [...(voice?.transcriptionHistory ?? []), transcription],
        }));
    };

    public clearTranscriptionHistory = () => {
        this.updateState((voice) => ({
            ...voice,
            transcriptionHistory: [],
        }));
    };

    public removeTranscriptionFromHistory = (id: string) => {
        this.updateState((voice) => ({
            ...voice,
            transcriptionHistory: (voice?.transcriptionHistory ?? []).filter((item) => item.id !== id),
        }));
    };

    public setRecordingState = (isRecording: boolean) => {
        this.updateState((voice) => ({
            ...voice,
            isRecording,
            recordingStartTime: isRecording ? Date.now() : undefined,
        }));
    };

    public transitionRecordingToTranscribing = () => {
        this.updateState((voice) => ({
            ...voice,
            isRecording: false,
            recordingStartTime: undefined,
            isTranscribing: true,
            transcribingStartTime: Date.now(),
        }));
    };

    public setTranscribingState = (isTranscribing: boolean) => {
        this.updateState((voice) => ({
            ...voice,
            isTranscribing,
            transcribingStartTime: isTranscribing ? Date.now() : undefined,
        }));
    };

    public transitionTranscribingToEnhancing = () => {
        this.updateState((voice) => ({
            ...voice,
            isTranscribing: false,
            transcribingStartTime: undefined,
            isEnhancing: true,
            enhancingStartTime: Date.now(),
        }));
    };

    public setEnhancingState = (isEnhancing: boolean) => {
        this.updateState((voice) => ({
            ...voice,
            isEnhancing,
            enhancingStartTime: isEnhancing ? Date.now() : undefined,
        }));
    };

    public setEnableAIEnhancement = (enableAIEnhancement: boolean) => {
        this.updateState((voice) => ({
            ...voice,
            enableAIEnhancement,
        }));
    };
}
