import {getAppData} from "../integrations/storage/localStoreActions.ts";
import {SecureStorage} from "../integrations/storage/secureStorage.ts";
import {Logger} from "../logger/Logger.ts";
import {StateAutoSaver} from "./StateAutoSaver.ts";
import {StateCleanup} from "./StateCleanup.ts";
import {store} from "./store";
import {INITIAL_GLOBAL_STATE} from "./store/global/const/INITIAL_GLOBAL_STATE.ts";
import {IGlobalState} from "./store/global/interfaces/IGlobalState.ts";

export class StateInitializer {
    public static async init(): Promise<void> {
        let state = await this.mergeWithLocalData();
        state = await this.mergeWithSecureStorage(state);
        state = StateCleanup.cleanEphemeralState(state) as IGlobalState;

        store.setState(state);
    }

    private static async mergeWithLocalData(): Promise<IGlobalState> {
        const defaultState = INITIAL_GLOBAL_STATE;
        const localData = await getAppData();

        Logger.info("[StateInitializer] localData from store:", {data: localData});
        Logger.info("[StateInitializer] providers count:", {data: localData?.provider?.collection?.length ?? "NO PROVIDERS"});

        const merged = this.deepMerge(defaultState, localData);
        Logger.info("[StateInitializer] merged state providers:", {data: merged?.provider?.collection?.length ?? "NO PROVIDERS"});

        return merged;
    }

    private static async mergeWithSecureStorage(state: IGlobalState): Promise<IGlobalState> {
        if (!state.provider?.collection || state.provider.collection.length === 0) {
            return state;
        }

        try {
            const uuids = state.provider.collection.map((p) => p.uuid);
            const secureKeys = await SecureStorage.getProviderKeys(uuids);

            state = {
                ...state,
                provider: {
                    ...state.provider,
                    collection: state.provider.collection.map((provider) => ({
                        ...provider,
                        apiKey: secureKeys[provider.uuid] || "",
                    })),
                },
            };

            Logger.info(`[StateInitializer] Loaded ${Object.keys(secureKeys).length} API keys from secure storage`);
            StateAutoSaver.initializeLastSavedKeys(secureKeys);

            return state;
        } catch (error) {
            Logger.error("[StateInitializer] Failed to load API keys from secure storage", {error});
            return state;
        }
    }

    protected static deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
        const result = {...target} as T;

        for (const key in source) {
            const sourceValue = source[key];
            const targetValue = target[key];

            if (sourceValue === undefined) {
                continue;
            }

            if (sourceValue === null) {
                result[key] = sourceValue as T[Extract<keyof T, string>];
                continue;
            }

            if (this.isPlainObject(targetValue) && this.isPlainObject(sourceValue)) {
                result[key] = this.deepMerge(targetValue, sourceValue) as T[Extract<keyof T, string>];
            } else {
                result[key] = sourceValue as T[Extract<keyof T, string>];
            }
        }

        return result;
    }

    protected static isPlainObject(value: any): value is Record<string, any> {
        return value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
    }
}
