import type {StoreApi, UseBoundStore} from "zustand";
import {IGlobalState} from "./global/interfaces/IGlobalState.ts";

let _store: UseBoundStore<StoreApi<IGlobalState>> | null = null;

export class GlobalStore {
    public static setStore(store: UseBoundStore<StoreApi<IGlobalState>>) {
        _store = store;
    }

    private static get store() {
        if (!_store) {
            throw new Error("GlobalStore not initialized. Call GlobalStore.setStore() first.");
        }
        return _store;
    }

    public static getStoreData<K extends keyof IGlobalState>(selector: K): IGlobalState[K] {
        return GlobalStore.store.getState()[selector];
    }

    public static updateState = <K extends keyof IGlobalState>(
        sectionKey: K,
        newSectionDataOrFunction: Partial<IGlobalState[K]> | ((section: IGlobalState[K], state: IGlobalState) => IGlobalState[K]),
    ) => {
        GlobalStore.store.setState((state: IGlobalState) => ({
            ...state,
            [sectionKey]:
                typeof newSectionDataOrFunction === "function"
                    ? newSectionDataOrFunction(state[sectionKey], state)
                    : {
                          ...state[sectionKey],
                          ...newSectionDataOrFunction,
                      },
        }));
    };
}
