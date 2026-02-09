import {Bot, HardDrive, Info} from "lucide-react";
import {NavLink} from "react-router-dom";
import {useGlobalState} from "../../hooks/useGlobalState.ts";
import {ROUTE_PATH} from "../../navigation/const/ROUTE_PATH.ts";
import {AISettingsView} from "../settings/AISettingsView.tsx";
import {LocalModelsView} from "../settings/LocalModelsView.tsx";
import {ContentPageLayout} from "../templates/ContentPageLayout.tsx";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "../ui/tabs.tsx";

const LANGUAGES = [
    {code: "pl-PL", name: "Polish"},
    {code: "en-US", name: "English"},
];

export function UnifiedModelsPageView() {
    const [voice, setVoice] = useGlobalState("voice");
    const {speechToText} = voice;

    const updateLanguage = (value: string) => {
        setVoice({
            speechToText: {
                ...speechToText,
                language: value,
            },
        });
    };

    return (
        <ContentPageLayout title="Models" icon={Bot}>
            <div className="flex flex-col gap-6">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">Transcription Language</span>
                    <div className="flex gap-1">
                        {LANGUAGES.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => updateLanguage(lang.code)}
                                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                                    speechToText.language === lang.code ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {lang.name}
                            </button>
                        ))}
                    </div>
                </div>

                <Tabs defaultValue="local">
                    <TabsList>
                        <TabsTrigger value="local">
                            <HardDrive className="w-4 h-4" />
                            Local
                        </TabsTrigger>
                        <TabsTrigger value="custom">
                            <Bot className="w-4 h-4" />
                            Custom
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="local">
                        <LocalModelsView />
                        <div className="mt-6 flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                            <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-muted-foreground">
                                For AI-powered text enhancement after transcription, add a cloud provider with text models in the{" "}
                                <NavLink to={ROUTE_PATH.ENHANCER} className="text-blue-500 hover:underline">
                                    Enhancer
                                </NavLink>{" "}
                                settings.
                            </p>
                        </div>
                    </TabsContent>
                    <TabsContent value="custom">
                        <AISettingsView />
                    </TabsContent>
                </Tabs>
            </div>
        </ContentPageLayout>
    );
}
