/**
 * Configuration for individual commands
 */
export interface ICommandConfig {
    /** Module identifier (e.g., "note", "quicklinks") */
    moduleId: string;

    /** Command name (e.g., "new-note", "browse-notes") */
    commandName: string;

    /** Whether the command is enabled and should appear in command panel */
    enabled: boolean;

    /** Optional alias for quick access (e.g., "nn" for "new-note") */
    alias?: string;

    /** Custom hotkey override (e.g., "CommandOrControl+Shift+N") */
    hotkey?: string;

    /** Timestamp of last modification */
    lastModified?: number;
}

/**
 * Configuration for entire modules
 */
export interface IModuleConfig {
    /** Module identifier */
    moduleId: string;

    /** Whether the entire module is enabled (disabling module disables all its commands) */
    enabled: boolean;

    /** Timestamp of last modification */
    lastModified?: number;
}

/**
 * Global module configuration state
 * Stored in GlobalStore and persisted across sessions
 */
export interface IModuleConfigState {
    /** Command configurations indexed by "moduleId:commandName" */
    commandConfigs: Record<string, ICommandConfig>;

    /** Module configurations indexed by "moduleId" */
    moduleConfigs: Record<string, IModuleConfig>;

    /** Schema version for migrations */
    version: number;
}

/**
 * Export/Import format for module configuration
 */
export interface IModuleConfigExport {
    version: number;
    exportedAt: number;
    commandConfigs: ICommandConfig[];
    moduleConfigs: IModuleConfig[];
}
