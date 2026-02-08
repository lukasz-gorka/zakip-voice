import {writeText} from "@tauri-apps/plugin-clipboard-manager";

export const copyToClipboard = async (value: string) => {
    await writeText(value);
};
