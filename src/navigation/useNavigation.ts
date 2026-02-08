import {platform} from "@tauri-apps/plugin-os";
import {useMemo} from "react";
import {NavigationItem} from "../types/NavigationItem.ts";
import {BASE_NAVIGATION} from "./const/BASE_NAVIGATION.ts";

export function useNavigation(): NavigationItem[] {
    const currentPlatform = platform();

    return useMemo(() => {
        return BASE_NAVIGATION.filter((item) => !item.platforms || item.platforms.includes(currentPlatform));
    }, [currentPlatform]);
}
