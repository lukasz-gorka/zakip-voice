import {AudioLines, Bot, History, Mic, Settings, Sparkles} from "lucide-react";
import {NavigationItem} from "../../types/NavigationItem.ts";
import {ROUTE_PATH} from "./ROUTE_PATH.ts";

export const BASE_NAVIGATION: NavigationItem[] = [
    {
        label: "Home",
        path: ROUTE_PATH.HOME,
        icon: Mic,
    },
    {
        label: "History",
        path: ROUTE_PATH.HISTORY,
        icon: History,
    },
    {
        label: "Models",
        path: ROUTE_PATH.MODELS,
        icon: Bot,
    },
    {
        label: "Speech-to-Text",
        path: ROUTE_PATH.VOICE_SETTINGS,
        icon: AudioLines,
    },
    {
        label: "Enhancer",
        path: ROUTE_PATH.ENHANCER,
        icon: Sparkles,
    },
    {
        label: "Settings",
        path: ROUTE_PATH.SETTINGS,
        icon: Settings,
    },
];
