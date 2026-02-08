import {Keyboard, RotateCcw, Settings, Sparkles} from "lucide-react";
import {NavLink, useNavigate} from "react-router-dom";
import {useGlobalState} from "../../hooks/useGlobalState.ts";
import {getAIModelsWithProvider, getProvidersWithTag} from "../../integrations/ai/aiModels/aiModels.ts";
import {AIModelTag} from "../../integrations/ai/interface/AIModelConfig.ts";
import {ROUTE_PATH} from "../../navigation/const/ROUTE_PATH.ts";
import {formatKeyForDisplay, parseKeystroke} from "../../utils/keystroke.ts";
import {DEFAULT_ENHANCEMENT_PROMPT} from "../../voice/const/TRANSCRIPTION_ENHANCEMENT_PROMPT.ts";
import {SpeechToTextSettings} from "../../voice/interfaces/IVoiceSettings.ts";
import {FormSelectUI} from "../form/FormSelectUI.tsx";
import {ContentPageLayout} from "../templates/ContentPageLayout.tsx";
import {Button} from "../ui/button.tsx";
import {Kbd} from "../ui/kbd.tsx";
import {Label} from "../ui/label.tsx";
import {Textarea} from "../ui/textarea.tsx";

export function EnhancerPageView() {
    const navigate = useNavigate();
    const [voice, setVoice] = useGlobalState("voice");
    const {speechToText} = voice;

    const allModels = getAIModelsWithProvider();
    const filterByTag = (tag: AIModelTag) => allModels.filter((m) => m.tags?.includes(tag));
    const filterByTagAndProvider = (tag: AIModelTag, providerId: string) => allModels.filter((m) => m.tags?.includes(tag) && m.providerId === providerId);

    const chatProviders = getProvidersWithTag("chat");
    const enhancementModels = speechToText.enhancementProviderId ? filterByTagAndProvider("chat", speechToText.enhancementProviderId) : filterByTag("chat");

    const updateSpeechToText = (updates: Partial<SpeechToTextSettings>) => {
        setVoice({
            speechToText: {
                ...speechToText,
                ...updates,
            },
        });
    };

    return (
        <ContentPageLayout title="Enhancer" icon={Sparkles}>
            <div className="flex flex-col gap-8">
                <div className="grid gap-2">
                    <Label>AI-Enhanced Transcription Shortcut</Label>
                    <NavLink to={ROUTE_PATH.SETTINGS} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {speechToText.globalShortcutWithAI ? (
                            parseKeystroke(speechToText.globalShortcutWithAI).map((key, i) => <Kbd key={i}>{formatKeyForDisplay(key)}</Kbd>)
                        ) : (
                            <span className="text-xs">Not set</span>
                        )}
                        <Keyboard className="h-3.5 w-3.5 ml-auto" />
                    </NavLink>
                </div>

                <div className="flex items-end gap-2">
                    <FormSelectUI
                        label="Provider"
                        value={speechToText.enhancementProviderId}
                        onValueChange={(value) => {
                            const modelsForProvider = filterByTagAndProvider("chat", value);
                            const firstModel = modelsForProvider[0]?.id || "";
                            updateSpeechToText({enhancementProviderId: value, enhancementModel: firstModel});
                        }}
                        items={chatProviders.map((provider) => ({value: provider.id, name: provider.name}))}
                        disabled={chatProviders.length === 0}
                    />
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate(ROUTE_PATH.MODELS)}>
                        <Settings className="w-4 h-4" />
                    </Button>
                </div>

                <FormSelectUI
                    label="Model"
                    value={speechToText.enhancementModel}
                    onValueChange={(value) => updateSpeechToText({enhancementModel: value})}
                    items={enhancementModels.map((model) => ({value: model.id, name: model.name || ""}))}
                    disabled={enhancementModels.length === 0}
                />

                <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="stt-enhancement-prompt">Enhancement Prompt</Label>
                        <Button variant="ghost" size="sm" onClick={() => updateSpeechToText({enhancementPrompt: DEFAULT_ENHANCEMENT_PROMPT})} className="h-7 px-2 text-xs">
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Reset to default
                        </Button>
                    </div>
                    <Textarea
                        id="stt-enhancement-prompt"
                        value={speechToText.enhancementPrompt || DEFAULT_ENHANCEMENT_PROMPT}
                        onChange={(e) => updateSpeechToText({enhancementPrompt: e.target.value})}
                        placeholder="Enter the AI enhancement prompt..."
                        className="min-h-[200px] font-mono text-xs"
                    />
                    <p className="text-xs text-muted-foreground">Prompt used by AI to enhance transcriptions. Use {"{{{MESSAGE}}}"} as placeholder for the transcribed text.</p>
                </div>
            </div>
        </ContentPageLayout>
    );
}
