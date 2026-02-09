import {GlobalStore} from "../appInitializer/store/GlobalStore.ts";
import {Logger} from "../logger/Logger.ts";
import {toggleWindow} from "../utils/windowUtils.ts";
import {GlobalShortcut} from "./GlobalShortcut.ts";
import {clearAllGlobalShortcuts, refreshGlobalShortcuts, ShortcutRegistrationError} from "./globalShortcutsConfig.ts";

export class GlobalShortcuts {
    private registrationErrors: ShortcutRegistrationError[] = [];

    public getRegistrationErrors(): ShortcutRegistrationError[] {
        return this.registrationErrors;
    }

    public async refreshShortcuts(): Promise<void> {
        const allShortcuts: GlobalShortcut[] = [];

        const voiceState = GlobalStore.getStoreData("voice");
        const stt = voiceState.speechToText;

        if (stt?.globalShortcut?.trim()) {
            allShortcuts.push(
                new GlobalShortcut(
                    stt.globalShortcut,
                    async () => {
                        const {G} = await import("../appInitializer/module/G.ts");
                        await G.voice.toggleRecordingForChat(false);
                    },
                    {
                        id: "voice-transcription-toggle",
                        label: "Toggle Voice Transcription",
                        editable: true,
                    },
                ),
            );
        }

        const hasEnhancementConfigured = stt?.enhancementProviderId?.trim() && stt?.enhancementModel?.trim();
        if (stt?.globalShortcutWithAI?.trim() && hasEnhancementConfigured) {
            allShortcuts.push(
                new GlobalShortcut(
                    stt.globalShortcutWithAI,
                    async () => {
                        const {G} = await import("../appInitializer/module/G.ts");
                        await G.voice.toggleRecordingForChat(true);
                    },
                    {
                        id: "voice-transcription-toggle-ai",
                        label: "Toggle Voice Transcription (AI Enhanced)",
                        editable: true,
                    },
                ),
            );
        }

        if (stt?.globalShortcutAbort?.trim()) {
            allShortcuts.push(
                new GlobalShortcut(
                    stt.globalShortcutAbort,
                    async () => {
                        const {G} = await import("../appInitializer/module/G.ts");
                        await G.voice.cancelProcessing();
                    },
                    {
                        id: "voice-abort",
                        label: "Abort Voice Processing",
                        editable: true,
                    },
                ),
            );
        }

        if (stt?.globalShortcutToggleApp?.trim()) {
            allShortcuts.push(
                new GlobalShortcut(
                    stt.globalShortcutToggleApp,
                    async () => {
                        await toggleWindow();
                    },
                    {
                        id: "toggle-app-visibility",
                        label: "Toggle App Visibility",
                        editable: true,
                    },
                ),
            );
        }

        this.registrationErrors = await refreshGlobalShortcuts(allShortcuts);

        const successCount = allShortcuts.length - this.registrationErrors.length;
        if (this.registrationErrors.length > 0) {
            Logger.warn(`[GlobalShortcuts] Registered ${successCount}/${allShortcuts.length} shortcuts (${this.registrationErrors.length} failed)`, {
                data: {shortcuts: allShortcuts, failures: this.registrationErrors},
            });
        } else {
            Logger.info(`[GlobalShortcuts] Registered ${allShortcuts.length} shortcuts`, {data: allShortcuts});
        }
    }

    public async clearAllShortcuts(): Promise<void> {
        await clearAllGlobalShortcuts();
    }
}
