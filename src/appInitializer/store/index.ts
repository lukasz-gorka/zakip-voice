import {create} from "zustand";
import {INITIAL_GLOBAL_STATE} from "./global/const/INITIAL_GLOBAL_STATE.ts";
import {IGlobalState} from "./global/interfaces/IGlobalState.ts";
import {GlobalStore} from "./GlobalStore.ts";

export const store = create<IGlobalState>(() => {
    return {
        ...(INITIAL_GLOBAL_STATE as IGlobalState),
    };
});

GlobalStore.setStore(store);
