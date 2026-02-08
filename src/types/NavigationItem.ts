import {ILucideIcon} from "../icons/interface/ILucideIcon.ts";

export interface NavigationItem {
    id?: string;
    label: string;
    path: string;
    icon?: ILucideIcon;
    description?: string;
    showInSidebar?: boolean;
    showInCommandPanel?: boolean;
    order?: number;
    roles?: string[]; // Required roles (OR logic) - show if user has ANY of these roles
    excludeRoles?: string[]; // Excluded roles - hide if user has ONLY this role (e.g., voice-only user)
    platforms?: string[]; // Show only on these platforms (e.g., ["macos"]). Undefined = all platforms.
}
