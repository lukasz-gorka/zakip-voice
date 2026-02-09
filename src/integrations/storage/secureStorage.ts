import {invoke} from "@tauri-apps/api/core";
import {Logger} from "../../logger/Logger.ts";

export class SecureStorage {
    public static async set(key: string, value: string): Promise<void> {
        try {
            await invoke("secure_storage_set", {key, value});
        } catch (error) {
            Logger.error(`[SecureStorage] Failed to store credential: ${key}`, {error});
            throw new Error(`Failed to store secure credential: ${error}`);
        }
    }

    public static async get(key: string): Promise<string> {
        try {
            return await invoke<string>("secure_storage_get", {key});
        } catch (error) {
            Logger.error(`[SecureStorage] Failed to retrieve credential: ${key}`, {error});
            throw new Error(`Failed to retrieve secure credential: ${error}`);
        }
    }

    public static async delete(key: string): Promise<void> {
        try {
            await invoke("secure_storage_delete", {key});
        } catch (error) {
            Logger.error(`[SecureStorage] Failed to delete credential: ${key}`, {error});
            throw new Error(`Failed to delete secure credential: ${error}`);
        }
    }

    public static async has(key: string): Promise<boolean> {
        try {
            return await invoke<boolean>("secure_storage_has", {key});
        } catch (error) {
            Logger.error(`[SecureStorage] Failed to check credential: ${key}`, {error});
            return false;
        }
    }

    public static async deleteProviderApiKey(providerUuid: string): Promise<void> {
        const key = `provider_${providerUuid}`;
        await this.delete(key);
    }

    public static async setProviderKeys(providerKeys: Record<string, string>): Promise<void> {
        try {
            await invoke("secure_storage_set_provider_keys", {providerKeys});
        } catch (error) {
            Logger.error("[SecureStorage] Failed to store provider keys", {error});
            throw new Error(`Failed to store provider keys: ${error}`);
        }
    }

    public static async getProviderKeys(providerUuids: string[]): Promise<Record<string, string>> {
        try {
            return await invoke<Record<string, string>>("secure_storage_get_provider_keys", {providerUuids});
        } catch (error) {
            Logger.error("[SecureStorage] Failed to retrieve provider keys", {error});
            return {};
        }
    }
}
