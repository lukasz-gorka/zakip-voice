import {invoke} from "@tauri-apps/api/core";
import {AudioLines, Keyboard, RotateCcw, Settings} from "lucide-react";
import {useCallback, useEffect, useState} from "react";
import {NavLink, useNavigate} from "react-router-dom";
import {G} from "../../../appInitializer/module/G.ts";
import {useGlobalState} from "../../../hooks/useGlobalState.ts";
import {getAIModelsWithProvider, getProvidersWithTag} from "../../../integrations/ai/aiModels/aiModels.ts";
import {AIModelTag} from "../../../integrations/ai/interface/AIModelConfig.ts";
import {ROUTE_PATH} from "../../../navigation/const/ROUTE_PATH.ts";
import type {LocalModelStatus} from "../../../rustProxy/types/LocalModelTypes.ts";
import {formatKeyForDisplay, parseKeystroke} from "../../../utils/keystroke.ts";
import {SpeechToTextSettings} from "../../../voice/interfaces/IVoiceSettings.ts";
import {FormSelectUI} from "../../form/FormSelectUI.tsx";
import {FormSwitchUI} from "../../form/FormSwitchUI.tsx";
import {ContentPageLayout} from "../../templates/ContentPageLayout.tsx";
import {Button} from "../../ui/button.tsx";
import {Kbd} from "../../ui/kbd.tsx";
import {Label} from "../../ui/label.tsx";
import {Separator} from "../../ui/separator.tsx";

export function VoiceSettingsPageView() {
    const navigate = useNavigate();
    const [voice, setVoice] = useGlobalState("voice");
    const {speechToText} = voice;
    const [localModels, setLocalModels] = useState<LocalModelStatus[]>([]);

    const fetchLocalModels = useCallback(async () => {
        try {
            const models = await invoke<LocalModelStatus[]>("local_models_list");
            setLocalModels(models.filter((m) => m.downloaded));
        } catch {
            // Local models not available
        }
    }, []);

    useEffect(() => {
        fetchLocalModels();
    }, [fetchLocalModels]);

    const allModels = getAIModelsWithProvider();
    const filterByTag = (tag: AIModelTag) => allModels.filter((m) => m.tags?.includes(tag));
    const filterByTagAndProvider = (tag: AIModelTag, providerId: string) => allModels.filter((m) => m.tags?.includes(tag) && m.providerId === providerId);

    const isLocalProvider = speechToText.providerId === "local";
    const sttModels = isLocalProvider
        ? localModels.map((m) => ({
              id: m.id,
              name: m.name,
              compositeId: m.id,
              providerId: "local",
              providerName: "Local",
              providerUuid: "local",
              enabled: true,
              tags: ["speech-to-text" as AIModelTag],
          }))
        : speechToText.providerId
          ? filterByTagAndProvider("speech-to-text", speechToText.providerId)
          : filterByTag("speech-to-text");
    const hasSttModels = sttModels.length > 0 || localModels.length > 0;
    const sttProviders = getProvidersWithTag("speech-to-text");

    // Build provider list with local option
    const providerItems = [
        ...(localModels.length > 0 ? [{value: "local", name: "Local (Free)"}] : []),
        ...sttProviders.map((provider) => ({value: provider.id, name: provider.name})),
    ];

    const updateSpeechToText = (updates: Partial<SpeechToTextSettings>) => {
        setVoice({
            speechToText: {
                ...speechToText,
                ...updates,
            },
        });
    };

    return (
        <ContentPageLayout title="Speech-to-Text" icon={AudioLines}>
            <div className="flex flex-col gap-8">
                <div className="grid gap-2">
                    <Label>Plain Transcription Shortcut</Label>
                    <NavLink to={ROUTE_PATH.SETTINGS} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {speechToText.globalShortcut ? (
                            parseKeystroke(speechToText.globalShortcut).map((key, i) => <Kbd key={i}>{formatKeyForDisplay(key)}</Kbd>)
                        ) : (
                            <span className="text-xs">Not set</span>
                        )}
                        <Keyboard className="h-3.5 w-3.5 ml-auto" />
                    </NavLink>
                </div>

                <div className="flex items-end gap-2">
                    <FormSelectUI
                        label="Provider"
                        value={speechToText.providerId}
                        onValueChange={(value) => {
                            updateSpeechToText({providerId: value, model: ""});
                        }}
                        items={providerItems}
                    />
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate(ROUTE_PATH.MODELS)}>
                        <Settings className="w-4 h-4" />
                    </Button>
                </div>
                <FormSelectUI
                    label="Model"
                    value={speechToText.model}
                    onValueChange={(value) => updateSpeechToText({model: value})}
                    items={sttModels.map((model) => ({value: model.id, name: model.name || model.id}))}
                />

                <Separator />

                <FormSwitchUI
                    value={speechToText.copyToClipboard}
                    label="Copy to Clipboard"
                    description="Automatically copy transcription to clipboard for use in other apps"
                    onValueChange={(checked) => updateSpeechToText({copyToClipboard: checked})}
                />
                <FormSwitchUI
                    value={speechToText.autoPasteAfterTranscription}
                    label="Auto-Paste After Transcription"
                    description="Automatically paste transcription where cursor is focused (requires 'Copy to Clipboard' enabled)"
                    onValueChange={(checked) => updateSpeechToText({autoPasteAfterTranscription: checked})}
                    disabled={!speechToText.copyToClipboard}
                />
                <FormSwitchUI
                    value={speechToText.playSoundNotification}
                    label="Play Sound Notifications"
                    description="Play sound effects when starting/stopping recording and copying to clipboard"
                    onValueChange={(checked) => updateSpeechToText({playSoundNotification: checked})}
                    disabled={!hasSttModels}
                />

                <Separator />

                <div className="grid gap-2">
                    <Label>Troubleshooting</Label>
                    <Button variant="outline" size="sm" onClick={() => G.voice.forceReset()} className="w-fit">
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reset Stuck Recording
                    </Button>
                    <p className="text-xs text-muted-foreground">Use this if recording gets stuck and won't start</p>
                </div>
            </div>
        </ContentPageLayout>
    );
}
