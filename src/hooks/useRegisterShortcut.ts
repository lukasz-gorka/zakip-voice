import {useEffect} from "react";
import {FUNCTION_KEY_NAME} from "../consts/FUNCTION_KEY_NAME.ts";

export type ShortcutConfig = {
    action: (event: KeyboardEvent) => void;
    triggerKey: string;
    modifierKey?: FUNCTION_KEY_NAME;
    requireModifier?: boolean;
};

export const useRegisterShortcut = (config: ShortcutConfig | ShortcutConfig[]) => {
    if (!config) return;

    const isModifierCorrect = (event: KeyboardEvent, modifierKey?: FUNCTION_KEY_NAME, requireModifier = true): boolean => {
        if (!modifierKey) return true;

        let modifierPressed = true;

        switch (modifierKey) {
            case FUNCTION_KEY_NAME.SHIFT:
                modifierPressed = event.shiftKey;
                break;
            case FUNCTION_KEY_NAME.CONTROL:
                modifierPressed = event.ctrlKey;
                break;
            case FUNCTION_KEY_NAME.CMD_OR_CTRL:
                modifierPressed = event.metaKey || event.ctrlKey;
                break;
            case FUNCTION_KEY_NAME.META:
                modifierPressed = event.metaKey;
                break;
            case FUNCTION_KEY_NAME.ALT:
                modifierPressed = event.altKey;
                break;
        }

        return requireModifier ? modifierPressed : !modifierPressed;
    };

    useEffect(() => {
        const handleKeyPress = (event: KeyboardEvent) => {
            const configs = Array.isArray(config) ? config : [config];

            configs.forEach(({action, triggerKey, modifierKey, requireModifier = true}) => {
                const modifierMatch = isModifierCorrect(event, modifierKey, requireModifier);
                if (!modifierMatch || event.key.toLowerCase() !== triggerKey.toLowerCase()) return;

                event.preventDefault();
                event.stopPropagation();

                action(event);
            });
        };

        document.addEventListener("keydown", handleKeyPress);

        return () => document.removeEventListener("keydown", handleKeyPress);
    }, [config]);
};
