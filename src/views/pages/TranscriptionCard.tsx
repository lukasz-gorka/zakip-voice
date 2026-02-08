import {Check, ChevronDown, ChevronUp, Clock, Copy, Sparkles, Trash2} from "lucide-react";
import React, {useState} from "react";
import {Logger} from "../../logger/Logger.ts";
import {TranscriptionHistoryItem} from "../../voice/interfaces/IVoiceSettings.ts";
import {Badge} from "../ui/badge.tsx";
import {Button} from "../ui/button.tsx";
import {Card, CardContent, CardFooter, CardHeader} from "../ui/card.tsx";
import {Collapsible, CollapsibleContent} from "../ui/collapsible.tsx";
import {ScrollArea} from "../ui/scroll-area.tsx";
import {Separator} from "../ui/separator.tsx";
import {Skeleton} from "../ui/skeleton.tsx";

interface TranscriptionCardProps {
    item?: TranscriptionHistoryItem;
    /** Header label, e.g. "Last transcription" */
    header?: string;
    /** Shows skeleton loading state */
    isLoading?: boolean;
    /** Badge shown during loading (e.g. "Processing", "Enhancing") */
    loadingBadge?: React.ReactNode;
    /** Wrap content in ScrollArea (for fixed-height cards) instead of expand/collapse */
    scrollContent?: boolean;
    /** Highlight matching text */
    searchQuery?: string;
    /** Show delete button */
    onDelete?: () => void;
    /** Additional className for the Card */
    className?: string;
}

export function TranscriptionCard({item, header, isLoading, loadingBadge, scrollContent, searchQuery, onDelete, className}: TranscriptionCardProps) {
    const [copied, setCopied] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [showRaw, setShowRaw] = useState(false);

    const canCopy = !isLoading && !!item;

    const handleCopy = async () => {
        if (!item) return;
        try {
            await navigator.clipboard.writeText(item.text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            Logger.error("Failed to copy to clipboard", {error});
        }
    };

    const handleCopyRaw = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!item?.rawText) return;
        try {
            await navigator.clipboard.writeText(item.rawText);
        } catch (error) {
            Logger.error("Failed to copy raw text", {error});
        }
    };

    // Text processing
    const lines = item?.text.split(/\n/) ?? [];
    const MAX_LINES = 3;
    const shouldCollapse = !scrollContent && lines.length > MAX_LINES;
    const displayText = shouldCollapse && !isExpanded ? lines.slice(0, MAX_LINES).join("\n") + "..." : (item?.text ?? "");

    const highlightText = (text: string) => {
        if (!searchQuery?.trim()) return text;
        const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const parts = text.split(new RegExp(`(${escaped})`, "gi"));
        return parts.map((part, i) =>
            part.toLowerCase() === searchQuery.toLowerCase() ? (
                <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
                    {part}
                </mark>
            ) : (
                part
            ),
        );
    };

    const wordCount = item ? item.text.trim().split(/\s+/).length : 0;
    const timeAgo = item ? getTimeAgo(new Date(item.timestamp)) : "";

    const showHeader = !!header || !!loadingBadge || (!isLoading && item?.isEnhanced);

    return (
        <Card
            className={`group relative flex flex-col bg-gradient-to-br from-muted/40 to-muted/20 border-border/50 w-full transition-all duration-300 ${
                canCopy ? "cursor-pointer hover:border-primary/40 hover:shadow-md" : ""
            } ${copied ? "border-green-500/50 shadow-green-500/10 shadow-md" : ""} ${className ?? ""}`}
            onClick={canCopy ? handleCopy : undefined}
        >
            {showHeader && (
                <CardHeader className="p-4 pb-2 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        {header ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {header}
                            </div>
                        ) : (
                            <div />
                        )}
                        {loadingBadge}
                        {!isLoading && item?.isEnhanced && (
                            <Badge variant="outline" className="text-xs text-primary border-primary/30">
                                <Sparkles className="w-3 h-3 mr-1" />
                                AI Enhanced
                            </Badge>
                        )}
                    </div>
                </CardHeader>
            )}

            <CardContent className={`p-4 ${showHeader ? "pt-0" : "pt-3"} flex-1 overflow-hidden`}>
                {isLoading ? (
                    <div className="space-y-2.5">
                        <Skeleton className="h-3.5 w-full" />
                        <Skeleton className="h-3.5 w-[85%]" />
                        <Skeleton className="h-3.5 w-[92%]" />
                        <Skeleton className="h-3.5 w-[65%]" />
                    </div>
                ) : item ? (
                    scrollContent ? (
                        <ScrollArea className="h-full">
                            <p className="text-sm leading-relaxed pr-2">{highlightText(item.text)}</p>
                        </ScrollArea>
                    ) : (
                        <>
                            <p className="text-sm leading-relaxed">{highlightText(displayText)}</p>
                            {shouldCollapse && (
                                <Button
                                    variant="link"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsExpanded(!isExpanded);
                                    }}
                                    className="mt-1 h-auto p-0 text-xs"
                                >
                                    {isExpanded ? "Show less" : "Show more"}
                                </Button>
                            )}
                        </>
                    )
                ) : (
                    <div className="h-full flex items-center justify-center">
                        <p className="text-sm text-muted-foreground/50">No transcriptions yet</p>
                    </div>
                )}
            </CardContent>

            {/* Raw text - collapsible (for enhanced items in expandable mode) */}
            {!scrollContent && item?.isEnhanced && item.rawText && (
                <Collapsible open={showRaw}>
                    <CollapsibleContent>
                        <div className="px-4 pb-2">
                            <Separator className="mb-2" />
                            <div className="flex items-start gap-2">
                                <p className="text-sm leading-relaxed text-muted-foreground flex-1">{highlightText(item.rawText)}</p>
                                <Button variant="ghost" size="icon" onClick={handleCopyRaw} className="shrink-0 h-6 w-6" title="Copy original text">
                                    <Copy className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            )}

            <CardFooter className="p-4 pt-0 flex-shrink-0">
                <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                        {timeAgo && (
                            <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {timeAgo}
                            </span>
                        )}
                        {!scrollContent && item && <span>{wordCount} words</span>}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Show original toggle */}
                        {!scrollContent && item?.isEnhanced && item.rawText && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowRaw(!showRaw);
                                }}
                                className="h-6 px-2 text-xs gap-1"
                            >
                                {showRaw ? (
                                    <>
                                        <ChevronUp className="w-3 h-3" />
                                        Hide original
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown className="w-3 h-3" />
                                        Show original
                                    </>
                                )}
                            </Button>
                        )}

                        {/* Copy indicator */}
                        {canCopy && (
                            <span className={`flex items-center gap-1 transition-all duration-300 ${copied ? "text-green-500" : ""}`}>
                                {copied ? (
                                    <>
                                        <Check className="w-3 h-3" />
                                        <span className="font-medium">Copied!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-3 h-3" />
                                        <span>Copy</span>
                                    </>
                                )}
                            </span>
                        )}

                        {/* Delete button */}
                        {onDelete && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete();
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80 h-6 w-6"
                                title="Delete transcription"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </CardFooter>
        </Card>
    );
}

function getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
}
