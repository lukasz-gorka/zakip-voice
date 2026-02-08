import {getCurrentWebviewWindow} from "@tauri-apps/api/webviewWindow";
import {LogicalSize} from "@tauri-apps/api/window";
import {Logger} from "../logger/Logger.ts";
import {G} from "./module/G.ts";
import {StateAutoSaver} from "./StateAutoSaver.ts";
import {StateInitializer} from "./StateInitializer.ts";

declare global {
    interface Window {
        G: typeof G;
    }
}

class AppInitializer {
    public async init(): Promise<void> {
        try {
            await this.mainInit();
            await G.init();

            await this.initState();

            await G.globalShortcuts.refreshShortcuts();
            G.autoUpdate.init();

            getCurrentWebviewWindow().onCloseRequested(async () => {
                await StateAutoSaver.forceSave();
            });
        } catch (error) {
            Logger.error("App Initialization Failed", {error});
            throw error;
        }
    }

    private mainInit = async () => {
        const appWindow = getCurrentWebviewWindow();
        await appWindow.setMinSize(new LogicalSize(800, 600));
    };

    private async initState() {
        await StateInitializer.init();
        StateAutoSaver.init();
    }
}

export const init = async (): Promise<void> => {
    Logger.log("🚀 App Initialization Started");
    await new AppInitializer().init();
};
