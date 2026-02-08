/**
 * TypeScript types for Terminal operations through Rust backend
 */

export interface TerminalSession {
    id: string;
    name: string;
    working_directory: string;
    created_at?: number;
}
