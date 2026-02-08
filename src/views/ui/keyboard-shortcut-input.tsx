import {AlertTriangle, Check, Command, X} from "lucide-react";
import {MouseEvent, useEffect, useRef, useState} from "react";
import {isMacOS} from "../../appEnvironment/appEnvironment.ts";
import {G} from "../../appInitializer/module/G.ts";
import {formatKeyForDisplay, formatKeysForValue, MODIFIER_KEYS, parseKeystroke} from "../../utils/keystroke";
import {Badge} from "./badge.tsx";
import {Button} from "./button.tsx";
import {Input} from "./input.tsx";
import {Kbd} from "./kbd.tsx";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "./tooltip.tsx";

interface KeyboardShortcutInputProps {
    initialValue?: string;
    onSave: (keystroke: string) => void;
    onCancel?: () => void;
    placeholder?: string;
    checkConflict?: (keystroke: string) => string | undefined;
    className?: string;
    disabled?: boolean;
    editable?: boolean;
}
export function KeyboardShortcutInput({
    initialValue = "",
    onSave,
    onCancel,
    placeholder = "Press keys...",
    checkConflict,
    className = "",
    disabled = false,
    editable = true,
}: KeyboardShortcutInputProps) {
    const [keys, setKeys] = useState<string[]>(parseKeystroke(initialValue));
    const [isEditing, setIsEditing] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const currentKeystroke = keys.length > 0 ? formatKeysForValue(keys) : "";
    const conflictingItem = checkConflict && currentKeystroke ? checkConflict(currentKeystroke) : undefined;
    const hasConflict = Boolean(conflictingItem);

    const startRecording = () => {
        if (disabled || !editable) return;
        setIsRecording(true);
        setKeys([]);

        if (inputRef.current) {
            inputRef.current.focus();
        }
    };

    const stopRecording = () => {
        setIsRecording(false);
    };

    const handleSave = () => {
        const keystrokeValue = keys.length > 0 ? formatKeysForValue(keys) : "";
        onSave(keystrokeValue);
        setIsEditing(false);
        setIsRecording(false);
        G.globalShortcuts.refreshShortcuts();
    };

    const handleCancel = () => {
        setKeys(parseKeystroke(initialValue));
        setIsRecording(false);
        setIsEditing(false);
        onCancel?.();
    };

    const handleClearShortcut = (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        setKeys([]);
        onSave("");
        setIsEditing(false);
        G.globalShortcuts.refreshShortcuts();
    };

    const handleStartEdit = () => {
        if (disabled || !editable) return;
        setIsEditing(true);
    };

    const keydownHandler = (event: KeyboardEvent) => {
        if (!isRecording) return;

        event.preventDefault();
        event.stopPropagation();

        if (event.repeat) return;

        const key = event.key;

        if (key === "Escape" && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
            handleCancel();
            return;
        }

        const newKeys: string[] = [];

        const isMac = isMacOS();

        if (isMac ? event.metaKey : event.ctrlKey) {
            newKeys.push("CmdOrCtrl");
        }

        if (isMac && event.ctrlKey) {
            newKeys.push("Control");
        }

        if (!isMac && event.metaKey) {
            newKeys.push("Super");
        }

        if (event.altKey) newKeys.push("Alt");
        if (event.shiftKey) newKeys.push("Shift");

        const isModifierKey = ["Control", "Alt", "Shift", "Meta", "Super"].includes(key);

        if (!isModifierKey) {
            let normalizedKey = key;

            // Use event.code for letters to avoid Polish diacritics (ę, ą, etc.)
            if (event.code.startsWith("Key") && event.code.length === 4) {
                normalizedKey = event.code.slice(3); // "KeyB" -> "B"
            } else if (event.code.startsWith("Digit") && event.code.length === 6) {
                normalizedKey = event.code.slice(5); // "Digit1" -> "1"
            } else if (key === " " || event.code === "Space") {
                normalizedKey = "Space";
            } else if (key.length === 1 && /[a-zA-Z]/.test(key)) {
                normalizedKey = key.toUpperCase();
            }

            newKeys.push(normalizedKey);
        }

        setKeys(newKeys);

        const hasNonModifier = newKeys.some((k) => !MODIFIER_KEYS.includes(k));
        if (hasNonModifier) {
            setTimeout(() => {
                stopRecording();
            }, 150);
        }
    };

    useEffect(() => {
        if (isRecording) {
            window.addEventListener("keydown", keydownHandler, true);
        }

        return () => {
            window.removeEventListener("keydown", keydownHandler, true);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRecording]);

    useEffect(() => {
        if (isEditing && !isRecording) {
            startRecording();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditing]);

    useEffect(() => {
        if (!isEditing) {
            setKeys(parseKeystroke(initialValue));
        }
    }, [initialValue, isEditing]);

    const displayValue = keys.length > 0 ? keys.map(formatKeyForDisplay).join(" + ") : "";

    if (!editable) {
        return (
            <div className={`flex items-center justify-center gap-1 h-9 px-3 rounded-md border border-input bg-muted/20 text-sm ${className}`}>
                {initialValue ? (
                    initialValue.split("+").map((key, index) => <Kbd key={index}>{formatKeyForDisplay(key)}</Kbd>)
                ) : (
                    <span className="text-muted-foreground">Not set</span>
                )}
            </div>
        );
    }

    if (!isEditing) {
        return (
            <div className={`flex items-center justify-center gap-1 h-9 px-3 rounded-md border border-input bg-muted/20 text-sm ${className}`}>
                {initialValue ? (
                    <>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Badge
                                        variant="secondary"
                                        className="cursor-pointer hover:bg-muted-foreground/20 gap-1"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleStartEdit();
                                        }}
                                    >
                                        {parseKeystroke(initialValue).map((key, index) => (
                                            <Kbd key={index}>{formatKeyForDisplay(key)}</Kbd>
                                        ))}
                                    </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="text-xs">Click to edit shortcut</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                            onClick={(event) => handleClearShortcut(event)}
                            disabled={disabled}
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    </>
                ) : (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit();
                        }}
                        disabled={disabled}
                    >
                        <Command className="h-3 w-3 mr-1" />
                        Add shortcut
                    </Button>
                )}
            </div>
        );
    }

    return (
        <TooltipProvider>
            <div className={`flex items-center justify-center gap-2 h-9 px-3 rounded-md border border-input bg-muted/20 text-sm ${className}`}>
                <div className="relative flex-1">
                    <Input
                        ref={inputRef}
                        value={displayValue}
                        readOnly
                        placeholder={isRecording ? placeholder : "Click to record"}
                        className={`h-6 text-xs text-center ${hasConflict ? "border-destructive" : ""}`}
                        onClick={startRecording}
                    />
                    {hasConflict && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="absolute right-1 top-1/2 transform -translate-y-1/2">
                                    <AlertTriangle className="h-3 w-3 text-destructive" />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="text-xs">Shortcut already used by: {conflictingItem}</p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>
                <div className="flex gap-1">
                    <Button variant="default" size="sm" className="h-6 w-6 p-0" onClick={handleSave} disabled={isRecording || hasConflict}>
                        <Check className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCancel}>
                        <X className="h-3 w-3" />
                    </Button>
                </div>
            </div>
        </TooltipProvider>
    );
}
