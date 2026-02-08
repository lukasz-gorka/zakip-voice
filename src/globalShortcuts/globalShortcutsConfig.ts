import {isRegistered, register, unregister, unregisterAll} from "@tauri-apps/plugin-global-shortcut";
import {Logger} from "../logger/Logger.ts";
import {GlobalShortcut} from "./GlobalShortcut.ts";

const registerKeystroke = async (shortcut: GlobalShortcut) => {
    if (!shortcut.keystroke || shortcut.keystroke.trim() === "") {
        Logger.info(`Skipping registration for shortcut with empty keystroke (id: ${shortcut.id})`);
        return;
    }

    const alreadyRegistered = await isRegistered(shortcut.keystroke);

    if (alreadyRegistered) {
        await unregister(shortcut.keystroke);
    }

    await register(shortcut.keystroke, (event) => {
        if (event.state === "Pressed") {
            Logger.info(`Global shortcut pressed: ${shortcut.keystroke}`);
            return shortcut.action();
        }
    });
};

const registerAllGlobalShortcuts = async (shortcuts: Array<GlobalShortcut>) => {
    await Promise.all(
        shortcuts
            .filter((item) => !!item.keystroke)
            .map(async (shortcut: GlobalShortcut) => {
                await registerKeystroke(shortcut);
            }),
    );
};

export const clearAllGlobalShortcuts = async (): Promise<void> => {
    try {
        await unregisterAll();
        Logger.info("All global shortcuts cleared successfully");
    } catch (error) {
        Logger.error("Failed to clear all shortcuts", {error});
    }
};

export const refreshGlobalShortcuts = async (shortcuts: Array<GlobalShortcut>) => {
    try {
        await clearAllGlobalShortcuts();
    } catch (error) {
        Logger.error("Failed to clear all shortcuts", {error});
    }

    await registerAllGlobalShortcuts(shortcuts);
};
