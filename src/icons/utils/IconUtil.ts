import {IconColor} from "../interface/IconColors.ts";

export class IconUtil {
    public static getColor(color: IconColor = "default"): string {
        const colorMap: Record<IconColor, string> = {
            blue: "text-blue-500",
            green: "text-green-500",
            purple: "text-purple-500",
            red: "text-red-500",
            orange: "text-orange-500",
            yellow: "text-yellow-500",
            cyan: "text-cyan-500",
            pink: "text-pink-500",
            gray: "text-muted-foreground",
            default: "text-primary",
        };

        return colorMap[color] || color;
    }
}
