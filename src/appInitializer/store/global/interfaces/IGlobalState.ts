import {IAutoUpdateState} from "../../../../autoUpdate/interfaces/IAutoUpdateState.ts";
import {AIProviderConfig} from "../../../../integrations/ai/interface/AIProviderConfig.ts";
import {IVoiceSettings} from "../../../../voice/interfaces/IVoiceSettings.ts";
import {IGlobalShortcutsState} from "./IGlobalShortcutsState.ts";

export interface IViewState {
    sidebarOpen: boolean;
}

export interface IGlobalState {
    provider: {
        collection: AIProviderConfig[];
    };
    view: IViewState;
    globalShortcuts: IGlobalShortcutsState;
    voice: IVoiceSettings;
    autoUpdate: IAutoUpdateState;
}
