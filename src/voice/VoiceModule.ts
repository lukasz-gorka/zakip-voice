import {invoke} from "@tauri-apps/api/core";
import {emitTo, listen} from "@tauri-apps/api/event";
import {WebviewWindow} from "@tauri-apps/api/webviewWindow";
import {isRegistered, register, unregister} from "@tauri-apps/plugin-global-shortcut";
import {G} from "../appInitializer/module/G.ts";
import {store} from "../appInitializer/store";
import {AIService} from "../integrations/ai/AIService.ts";
import {Logger} from "../logger/Logger.ts";
import {ChatCompletionRequest, ProviderCredentials} from "../rustProxy/types/AITypes.ts";
import {playCopySound, playStartSound, playStopSound} from "../sound/sounds.ts";
import * as backendAudio from "../utils/backendAudioRecorder.ts";
import {resetBackendRecording} from "../utils/backendAudioRecorder.ts";
import {copyToClipboard} from "../utils/clipboard.ts";
import {toast} from "../views/ui/use-toast.ts";
import {DEFAULT_ENHANCEMENT_PROMPT} from "./const/TRANSCRIPTION_ENHANCEMENT_PROMPT.ts";
import {IVoiceSettings, TranscriptionHistoryItem} from "./interfaces/IVoiceSettings.ts";
import {VoiceStoreManager} from "./store/VoiceStoreManager.ts";

const RECORDING_POPUP_LABEL = "voice-recording-popup";

interface VoiceModuleDeps {
    storeManager: VoiceStoreManager;
    ai: AIService;
}

export class VoiceModule {
    private storeManager: VoiceStoreManager;
    private ai: AIService;

    private currentSession: backendAudio.AudioRecordingSession | null = null;
    private popupActionUnlisten: (() => void) | null = null;
    private currentOperationId: string | null = null;
    private abortRequested: boolean = false;
    private isStartingRecording: boolean = false;

    constructor(deps: VoiceModuleDeps) {
        this.storeManager = deps.storeManager;
        this.ai = deps.ai;
    }

    public state = (): IVoiceSettings => this.storeManager.state();

    public setEnableAIEnhancement = (enable: boolean): void => {
        this.storeManager.setEnableAIEnhancement(enable);
    };

    public async toggleRecordingForChat(withAI?: boolean): Promise<void> {
        Logger.info("[VoiceModule] toggleRecordingForChat called", {
            data: {withAI, isRecording: this.currentSession !== null, isStarting: this.isStartingRecording},
        });

        if (withAI !== undefined) {
            this.storeManager.setEnableAIEnhancement(withAI);
        }

        const isRecording = this.currentSession !== null;
        const isStarting = this.isStartingRecording;

        if (isRecording) {
            Logger.info("[VoiceModule] Stopping recording (session active)");
            await this.stopRecordingAndTranscribe();
        } else if (!isStarting) {
            Logger.info("[VoiceModule] Starting recording (no session, not starting)");
            await this.startRecording();
        } else {
            Logger.warn("[VoiceModule] Recording start already in progress, ignoring duplicate call");
        }
    }

    public async cancelRecording(): Promise<void> {
        if (!this.currentSession) {
            Logger.warn("[VoiceModule] No active recording to cancel");
            return;
        }

        try {
            await backendAudio.cancelBackendRecording(this.currentSession.session_id);
            this.currentSession = null;

            this.storeManager.setRecordingState(false);
            this.storeManager.setTranscribingState(false);
            await this.unregisterEscapeShortcut();
            await this.closeRecordingPopup();

            Logger.info("[VoiceModule] Recording cancelled");
        } catch (error) {
            this.currentSession = null;
            this.storeManager.setRecordingState(false);
            this.storeManager.setTranscribingState(false);
            await this.unregisterEscapeShortcut();
            await this.closeRecordingPopup();
            Logger.error("[VoiceModule] Failed to cancel recording:", {error});
        }
    }

    /**
     * Cancel an in-progress processing operation (transcription or enhancement).
     * Aborts the Rust-side AI operation and resets all state.
     */
    /**
     * Cancel any in-progress voice operation — recording, transcription, or enhancement.
     * This is the single entry point for the global abort shortcut.
     */
    public async cancelProcessing(): Promise<void> {
        Logger.info("[VoiceModule] Cancelling all voice processing");

        // If there's an active recording session, cancel it directly
        if (this.currentSession) {
            try {
                await backendAudio.cancelBackendRecording(this.currentSession.session_id);
                Logger.info("[VoiceModule] Cancelled active recording session");
            } catch (error) {
                Logger.warn("[VoiceModule] Failed to cancel recording session:", {error});
            }
        }

        // If there's an in-flight AI operation (transcription/enhancement), abort it
        if (this.currentOperationId) {
            try {
                await G.rustProxy.abortOperation(this.currentOperationId);
                Logger.info("[VoiceModule] Aborted operation:", {data: this.currentOperationId});
            } catch (error) {
                Logger.warn("[VoiceModule] Failed to abort operation (may have already finished):", {error});
            }
        }

        // forceReset clears all flags including abortRequested, currentSession, currentOperationId
        await this.forceReset();
    }

    private async handlePopupAction(action: string): Promise<void> {
        Logger.info("[VoiceModule] Popup action received:", {data: action});

        if (action === "stop") {
            // Stop recording → proceed to transcription
            await this.toggleRecordingForChat();
        } else if (action === "cancel") {
            // Cancel in-progress processing
            await this.cancelProcessing();
        }
    }

    private async registerEscapeShortcut(): Promise<void> {
        try {
            const alreadyRegistered = await isRegistered("Escape");
            if (alreadyRegistered) {
                await unregister("Escape");
            }

            await register("Escape", (event) => {
                if (event.state === "Pressed") {
                    Logger.info("[VoiceModule] Escape pressed, cancelling recording");
                    this.cancelRecording();
                }
            });

            Logger.info("[VoiceModule] Escape shortcut registered");
        } catch (error) {
            Logger.error("[VoiceModule] Failed to register Escape shortcut:", {error});
        }
    }

    private async unregisterEscapeShortcut(): Promise<void> {
        try {
            const registered = await isRegistered("Escape");
            if (registered) {
                await unregister("Escape");
                Logger.info("[VoiceModule] Escape shortcut unregistered");
            }
        } catch (error) {
            Logger.error("[VoiceModule] Failed to unregister Escape shortcut:", {error});
        }
    }

    private async startRecording(isRetry: boolean = false): Promise<void> {
        Logger.info("[VoiceModule] startRecording called", {data: {isRetry, isStartingRecording: this.isStartingRecording}});

        // Prevent concurrent recording starts
        if (this.isStartingRecording) {
            Logger.warn("[VoiceModule] Recording start already in progress, skipping");
            return;
        }

        this.isStartingRecording = true;
        Logger.info("[VoiceModule] Set isStartingRecording = true");

        try {
            this.storeManager.setRecordingState(true);
            Logger.info("[VoiceModule] Set recording state = true");

            await this.showRecordingPopup();
            Logger.info("[VoiceModule] Recording popup shown");

            // Start backend recording (permission already checked on app startup)
            Logger.info("[VoiceModule] Starting backend recording...");
            this.currentSession = await backendAudio.startBackendRecording({
                echo_cancellation: true,
                noise_suppression: true,
                auto_gain_control: true,
            });

            await emitTo(RECORDING_POPUP_LABEL, `recording-popup-state-${RECORDING_POPUP_LABEL}`, {state: "recording"});

            const settings = this.state();
            if (settings.speechToText.playSoundNotification) {
                playStartSound();
            }

            await this.registerEscapeShortcut();

            // Recording started successfully
            this.isStartingRecording = false;
        } catch (error) {
            this.isStartingRecording = false;
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (!isRetry && errorMessage.includes("already in progress")) {
                const wasReset = await this.forceReset();
                if (wasReset) {
                    return this.startRecording(true);
                }
            }

            this.currentSession = null;
            this.storeManager.setRecordingState(false);
            await this.closeRecordingPopup();
            await this.unregisterEscapeShortcut();
            Logger.error("[VoiceModule] Failed to start recording:", {error});

            // Check if it's a permissions error
            const isPermissionError =
                errorMessage.toLowerCase().includes("permission") || errorMessage.toLowerCase().includes("access") || errorMessage.toLowerCase().includes("denied");

            if (isPermissionError) {
                toast({
                    title: "Microphone access required",
                    description: "Please grant microphone permission in System Settings → Privacy & Security → Microphone, then restart the app.",
                    variant: "destructive",
                    duration: 10000,
                });
            } else {
                toast({
                    title: "Recording failed",
                    description: errorMessage,
                    variant: "destructive",
                });
            }

            throw error;
        }
    }

    public async forceReset(): Promise<boolean> {
        try {
            const wasReset = await resetBackendRecording();
            this.currentSession = null;
            this.isStartingRecording = false;
            this.abortRequested = false;
            this.currentOperationId = null;
            this.storeManager.setRecordingState(false);
            this.storeManager.setTranscribingState(false);
            this.storeManager.setEnhancingState(false);
            await this.unregisterEscapeShortcut();
            await this.closeRecordingPopup();

            if (wasReset) {
                Logger.info("[VoiceModule] Force reset cleared stuck recording");
                toast({
                    title: "Recording reset",
                    description: "Stuck recording state was cleared",
                });
            }

            return wasReset;
        } catch (error) {
            Logger.error("[VoiceModule] Force reset failed:", {error});
            return false;
        }
    }

    private async setupPopupActionListener(): Promise<void> {
        if (this.popupActionUnlisten) return;

        try {
            this.popupActionUnlisten = await listen<{action: string}>("voice-popup-action", (event) => {
                this.handlePopupAction(event.payload.action);
            });
            Logger.info("[VoiceModule] Popup action listener set up");
        } catch (error) {
            Logger.error("[VoiceModule] Failed to setup popup action listener:", {error});
        }
    }

    private cleanupPopupActionListener(): void {
        if (this.popupActionUnlisten) {
            this.popupActionUnlisten();
            this.popupActionUnlisten = null;
            Logger.info("[VoiceModule] Popup action listener cleaned up");
        }
    }

    private async showRecordingPopup(): Promise<void> {
        try {
            Logger.info("[VoiceModule] Showing recording popup");

            await this.setupPopupActionListener();

            const existing = await WebviewWindow.getByLabel(RECORDING_POPUP_LABEL);

            if (existing) {
                const isVisible = await existing.isVisible();

                Logger.info("[VoiceModule] Existing popup found, visible:", {data: isVisible});

                // Reposition to bottom-center of current monitor
                const {primaryMonitor, currentMonitor} = await import("@tauri-apps/api/window");
                const {PhysicalPosition} = await import("@tauri-apps/api/window");
                let mon = await currentMonitor().catch(() => null);
                if (!mon) mon = await primaryMonitor().catch(() => null);

                if (mon) {
                    const actualSize = await existing.outerSize();
                    const offsetY = 12;
                    const fx = (mon.position?.x || 0) + ((mon.size?.width || 1920) - actualSize.width) / 2;
                    const fy = (mon.position?.y || 0) + (mon.size?.height || 1080) - actualSize.height - offsetY;
                    await existing.setPosition(new PhysicalPosition(fx, fy));
                }

                await emitTo(RECORDING_POPUP_LABEL, `recording-popup-state-${RECORDING_POPUP_LABEL}`, {state: "initializing"});
                await existing.show();
                await existing.setFocus();
                Logger.info("[VoiceModule] Existing recording popup shown");
                return;
            }

            const {primaryMonitor, currentMonitor} = await import("@tauri-apps/api/window");
            let monitor = null;

            // Try to get the monitor where user is currently focused
            try {
                monitor = await currentMonitor();
                Logger.info("[VoiceModule] Using current monitor", {data: {size: monitor?.size, position: monitor?.position}});
            } catch (error) {
                Logger.debug("[VoiceModule] Could not get current monitor, trying primary", {error});
            }

            // Fallback to primary monitor
            if (!monitor) {
                try {
                    monitor = await primaryMonitor();
                    Logger.info("[VoiceModule] Using primary monitor", {data: {size: monitor?.size, position: monitor?.position}});
                } catch (error) {
                    Logger.warn("[VoiceModule] Could not get primary monitor, using defaults", {error});
                }
            }

            // Compact single-line design
            const width = 280;
            const height = 48;
            const screenWidth = monitor?.size?.width || 1920;
            const screenHeight = monitor?.size?.height || 1080;
            const monitorX = monitor?.position?.x || 0;
            const monitorY = monitor?.position?.y || 0;

            // Bottom-center position (very bottom of MONITOR, not window)
            const offsetY = 12;
            const x = monitorX + (screenWidth - width) / 2;
            const y = monitorY + screenHeight - height - offsetY;

            Logger.info("[VoiceModule] Creating popup window", {
                data: {width, height, x, y, screenWidth, screenHeight, monitor: {size: monitor?.size, position: monitor?.position}},
            });

            // Emit diagnostic info to main window
            await emitTo("main", "popup-diagnostic", {
                action: "creating",
                position: {x, y},
                size: {width, height},
                monitor: {size: monitor?.size, position: monitor?.position},
            });

            const window = new WebviewWindow(RECORDING_POPUP_LABEL, {
                url: "/recording-popup.html",
                title: "Recording",
                width,
                height,
                x,
                y,
                resizable: false,
                alwaysOnTop: true,
                decorations: false,
                skipTaskbar: true,
                focus: true,
                visible: false,
                transparent: false,
            });

            Logger.info("[VoiceModule] Waiting for window creation...");

            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error("Window creation timeout"));
                }, 5000);

                window.once("tauri://created", () => {
                    clearTimeout(timeout);
                    Logger.info("[VoiceModule] Window created successfully");
                    resolve();
                });

                window.once("tauri://error", (e) => {
                    clearTimeout(timeout);
                    Logger.error("[VoiceModule] Window creation error", {error: e});
                    reject(e);
                });
            });

            // Wait a bit for the page to load
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Get actual window size and recalculate position
            const {PhysicalPosition} = await import("@tauri-apps/api/window");
            const actualSize = await window.outerSize();
            const actualWidth = actualSize.width;
            const actualHeight = actualSize.height;

            // Bottom-center position using actual window size
            const finalX = monitorX + (screenWidth - actualWidth) / 2;
            const finalY = monitorY + screenHeight - actualHeight - offsetY;

            await window.setPosition(new PhysicalPosition(finalX, finalY));

            Logger.info("[VoiceModule] Showing window...", {
                data: {
                    actualSize: {width: actualWidth, height: actualHeight},
                    finalPosition: {x: finalX, y: finalY},
                },
            });

            // Emit to main window for visibility
            await emitTo("main", "popup-diagnostic", {
                action: "positioning",
                actualSize: {width: actualWidth, height: actualHeight},
                finalPosition: {x: finalX, y: finalY},
            });

            await window.show();
            await window.setFocus();

            await new Promise((resolve) => setTimeout(resolve, 200));

            await emitTo(RECORDING_POPUP_LABEL, `recording-popup-state-${RECORDING_POPUP_LABEL}`, {state: "initializing"});

            await new Promise((resolve) => setTimeout(resolve, 200));

            const isVisible = await window.isVisible();
            const position = await window.outerPosition();
            Logger.info("[VoiceModule] Recording popup shown", {
                data: {
                    isVisible,
                    position: {x: position.x, y: position.y},
                },
            });

            // Emit final status to main window
            await emitTo("main", "popup-diagnostic", {
                action: "shown",
                isVisible,
                position: {x: position.x, y: position.y},
            });

            if (!isVisible) {
                Logger.warn("[VoiceModule] Window is not visible after show() call - trying to show again");
                await emitTo("main", "popup-diagnostic", {
                    action: "warning",
                    message: "Window not visible after show() - retrying",
                });
                await window.show();
                await window.setFocus();
            }
        } catch (error) {
            Logger.error("[VoiceModule] Failed to show recording popup:", {error});
        }
    }

    private async closeRecordingPopup(): Promise<void> {
        try {
            const existing = await WebviewWindow.getByLabel(RECORDING_POPUP_LABEL);
            if (existing) {
                await emitTo(RECORDING_POPUP_LABEL, `recording-popup-state-${RECORDING_POPUP_LABEL}`, {state: "initializing"});
                await existing.hide();
                Logger.info("[VoiceModule] Recording popup hidden");
            }
            this.cleanupPopupActionListener();
        } catch (error) {
            Logger.error("[VoiceModule] Failed to close recording popup:", {error});
        }
    }

    private async stopRecordingAndTranscribe(): Promise<void> {
        try {
            if (!this.currentSession) {
                throw new Error("No active recording");
            }

            const result = await backendAudio.stopBackendRecording(this.currentSession.session_id);
            const audioBlob = backendAudio.audioResultToBlob(result);

            this.currentSession = null;
            this.storeManager.transitionRecordingToTranscribing();
            Logger.info("[VoiceModule] Switching to transcribing state, duration:", {data: result.duration_ms});
            await this.unregisterEscapeShortcut();
            await emitTo(RECORDING_POPUP_LABEL, `recording-popup-state-${RECORDING_POPUP_LABEL}`, {state: "transcribing"});

            const settings = this.state();

            if (settings.speechToText.playSoundNotification) {
                playStopSound();
            }

            const transcribeOperationId = `transcribe-${Date.now()}`;
            this.currentOperationId = transcribeOperationId;

            const {text: transcription} = await this.ai.audio.transcribe(
                audioBlob,
                {
                    providerId: settings.speechToText.providerId,
                    model: settings.speechToText.model,
                    language: settings.speechToText.language,
                    prompt: settings.speechToText.prompt,
                },
                transcribeOperationId,
            );

            this.currentOperationId = null;

            if (this.abortRequested) {
                Logger.info("[VoiceModule] Abort requested after transcription, stopping");
                this.abortRequested = false;
                return;
            }

            Logger.info(`[VoiceModule] Transcription successful: ${transcription}`);

            let finalText = transcription;
            const enableAI = settings.enableAIEnhancement ?? true;
            const hasEnhancementConfigured = settings.speechToText.enhancementProviderId && settings.speechToText.enhancementModel;
            const enhancementProviderExists = hasEnhancementConfigured && this.isEnhancementProviderValid();

            if (enableAI && enhancementProviderExists) {
                this.storeManager.transitionTranscribingToEnhancing();
                await emitTo(RECORDING_POPUP_LABEL, `recording-popup-state-${RECORDING_POPUP_LABEL}`, {state: "enhancing"});

                finalText = await this.enhanceTranscription(transcription);

                if (this.abortRequested) {
                    Logger.info("[VoiceModule] Abort requested after enhancement, stopping");
                    this.abortRequested = false;
                    return;
                }

                this.storeManager.setEnhancingState(false);
            } else {
                this.storeManager.setTranscribingState(false);
                if (enableAI && !enhancementProviderExists) {
                    Logger.info("[VoiceModule] AI enhancement skipped (provider not configured or missing)");
                } else {
                    Logger.info("[VoiceModule] AI enhancement skipped (plain transcription mode)");
                }
            }

            await this.closeRecordingPopup();

            Logger.info(`[VoiceModule] Final text: ${finalText}`);

            const historyItem: TranscriptionHistoryItem = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                text: finalText,
                timestamp: Date.now(),
                modelName: settings.speechToText.model,
                ...(enableAI &&
                    enhancementProviderExists && {
                        rawText: transcription,
                        isEnhanced: true,
                    }),
            };

            this.storeManager.addTranscriptionToHistory(historyItem);

            if (settings.speechToText.copyToClipboard) {
                await this.copyToClipboardInternal(finalText);
            }
        } catch (error) {
            this.currentOperationId = null;

            // If abort was requested, this error is expected — just clean up silently
            if (this.abortRequested) {
                this.abortRequested = false;
                Logger.info("[VoiceModule] Processing aborted by user");
                return;
            }

            this.currentSession = null;
            this.storeManager.setRecordingState(false);
            this.storeManager.setTranscribingState(false);
            this.storeManager.setEnhancingState(false);
            await this.unregisterEscapeShortcut();
            await this.closeRecordingPopup();
            Logger.error("[VoiceModule] Failed to transcribe audio:", {error});

            const errorMessage = error instanceof Error ? error.message : String(error);
            toast({
                title: "Transcription failed",
                description: errorMessage,
                variant: "destructive",
            });

            throw error;
        }
    }

    private async copyToClipboardInternal(text: string): Promise<void> {
        try {
            await copyToClipboard(text);

            const settings = this.state();

            if (settings.speechToText.playSoundNotification) {
                playCopySound();
            }

            Logger.info("[VoiceModule] Copied to clipboard");

            // Auto-paste if enabled
            if (settings.speechToText.autoPasteAfterTranscription) {
                await this.simulatePaste();
            }
        } catch (error) {
            Logger.error("[VoiceModule] Failed to copy to clipboard:", {error});
        }
    }

    private async simulatePaste(): Promise<void> {
        try {
            await invoke("simulate_paste");
            Logger.info("[VoiceModule] Auto-paste executed");
        } catch (error) {
            Logger.error("[VoiceModule] Failed to simulate paste:", {error});

            const hasShownPermissionToast = localStorage.getItem("accessibility_permission_toast_shown");

            if (!hasShownPermissionToast) {
                toast({
                    title: "Auto-Paste Requires Accessibility Permissions",
                    description:
                        "Please grant accessibility permissions in System Settings > Privacy & Security > Accessibility, then restart the app. The system dialog should appear only once.",
                    variant: "destructive",
                    duration: 15000,
                });
                localStorage.setItem("accessibility_permission_toast_shown", "true");

                // Log helpful instructions
                Logger.warn("[VoiceModule] Accessibility permissions not granted. User should:", {
                    data: {
                        steps: ["1. Open System Settings", "2. Go to Privacy & Security > Accessibility", "3. Enable ai-assistant-app", "4. Restart the app"],
                    },
                });
            } else {
                Logger.warn("[VoiceModule] Auto-paste failed (permissions likely not granted yet)");
            }
        }
    }

    private isEnhancementProviderValid(): boolean {
        const globalState = store.getState();
        const settings = this.state();
        const providerId = settings.speechToText.enhancementProviderId;
        if (!providerId) return false;
        return globalState.provider.collection.some((p) => p.id === providerId);
    }

    private getEnhancementCredentials(): ProviderCredentials {
        const globalState = store.getState();
        const settings = this.state();
        const providerId = settings.speechToText.enhancementProviderId;

        if (!providerId) {
            throw new Error("Enhancement provider not configured");
        }

        const provider = globalState.provider.collection.find((p) => p.id === providerId);

        if (!provider) {
            throw new Error(`Enhancement provider "${providerId}" not found`);
        }

        return {
            api_key: provider.apiKey,
            base_url: provider.baseURL || "https://api.openai.com/v1",
        };
    }

    private async enhanceTranscription(rawText: string): Promise<string> {
        try {
            const operationId = `enhance-${Date.now()}`;
            this.currentOperationId = operationId;
            const settings = this.state();

            if (!settings.speechToText.enhancementModel) {
                throw new Error("Enhancement model not configured");
            }

            const credentials = this.getEnhancementCredentials();
            const enhancementPrompt = settings.speechToText.enhancementPrompt || DEFAULT_ENHANCEMENT_PROMPT;
            const model = settings.speechToText.enhancementModel;

            const promptWithText = enhancementPrompt.replace("{{{MESSAGE}}}", rawText);

            const request: ChatCompletionRequest = {
                model,
                messages: [
                    {
                        role: "user",
                        content: promptWithText,
                    },
                ],
            };

            Logger.info("[VoiceModule] Sending transcription for enhancement", {
                data: {model, textLength: rawText.length},
            });

            const response = await G.rustProxy.chatCompletion(request, operationId, credentials);

            this.currentOperationId = null;

            const enhancedText = response.choices[0]?.message?.content?.trim();

            if (!enhancedText) {
                Logger.warn("[VoiceModule] Enhancement returned empty, using raw text");
                return rawText;
            }

            Logger.info("[VoiceModule] Enhancement successful", {
                data: {originalLength: rawText.length, enhancedLength: enhancedText.length},
            });

            return enhancedText;
        } catch (error) {
            this.currentOperationId = null;
            Logger.error("[VoiceModule] Enhancement failed, using raw text:", {error});

            const errorMessage = error instanceof Error ? error.message : String(error);
            const userMessage = errorMessage.includes("404")
                ? "Model not available on this provider. Check enhancement model settings."
                : errorMessage.includes("401") || errorMessage.includes("403")
                  ? "Authentication failed. Check provider API key."
                  : "Unexpected error. Check logs for details.";
            toast({
                title: "AI Enhancement failed",
                description: `Using raw transcription. ${userMessage}`,
                variant: "destructive",
            });

            return rawText;
        }
    }

    public async clearHistory(): Promise<void> {
        this.storeManager.clearTranscriptionHistory();
    }

    public async removeTranscription(id: string): Promise<void> {
        this.storeManager.removeTranscriptionFromHistory(id);
    }
}
