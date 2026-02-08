import {History, Search, Trash2} from "lucide-react";
import {useEffect, useMemo, useRef, useState} from "react";
import {G} from "../../appInitializer/module/G.ts";
import {useGlobalState} from "../../hooks/useGlobalState.ts";
import {Logger} from "../../logger/Logger.ts";
import {ContentPageLayout} from "../templates/ContentPageLayout.tsx";
import {Input} from "../ui/input.tsx";
import {Kbd} from "../ui/kbd.tsx";
import {ScrollArea} from "../ui/scroll-area.tsx";
import {TranscriptionCard} from "./TranscriptionCard.tsx";

export function VoiceHistoryView() {
    const [voice] = useGlobalState("voice");
    const [searchQuery, setSearchQuery] = useState("");
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
            if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
                searchInputRef.current?.blur();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const handleClearHistory = async () => {
        try {
            await G.voice.clearHistory();
        } catch (error) {
            Logger.error("Failed to clear history", {error});
        }
    };

    const sortedHistory = useMemo(() => {
        return [...voice.transcriptionHistory].sort((a, b) => b.timestamp - a.timestamp);
    }, [voice.transcriptionHistory]);

    const filteredHistory = useMemo(() => {
        if (!searchQuery.trim()) return sortedHistory;
        const query = searchQuery.toLowerCase();
        return sortedHistory.filter((item) => item.text.toLowerCase().includes(query));
    }, [sortedHistory, searchQuery]);

    return (
        <ContentPageLayout
            title="History"
            icon={History}
            actions={
                voice?.transcriptionHistory.length > 0
                    ? [
                          {
                              label: "Clear All",
                              icon: Trash2,
                              onClick: handleClearHistory,
                              variant: "destructive",
                          },
                      ]
                    : undefined
            }
        >
            <div className="h-full flex flex-col">
                {sortedHistory.length > 0 ? (
                    <>
                        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4 mb-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    ref={searchInputRef}
                                    placeholder="Search transcriptions..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-12"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <Kbd>/</Kbd>
                                </div>
                            </div>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="space-y-3 pr-4">
                                {filteredHistory.map((item) => (
                                    <TranscriptionCard key={item.id} item={item} searchQuery={searchQuery} onDelete={() => G.voice.removeTranscription(item.id)} />
                                ))}
                            </div>
                        </ScrollArea>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                        <History className="w-12 h-12 mb-4 opacity-50" />
                        <p className="text-lg">No transcriptions yet</p>
                        <p className="text-sm">Start recording to see your transcriptions here</p>
                    </div>
                )}
            </div>
        </ContentPageLayout>
    );
}
