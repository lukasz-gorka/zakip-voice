import {SystemLogVariant} from "./SystemLogVariant.ts";

export interface ILogEntry {
    id: string;
    timestamp: string;
    level: SystemLogVariant;
    message: string;
    error?: unknown;
    data?: unknown;
}
