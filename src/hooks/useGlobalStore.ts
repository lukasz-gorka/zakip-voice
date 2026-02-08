import {store} from "../appInitializer/store";
import {IGlobalState} from "../appInitializer/store/global/interfaces/IGlobalState.ts";

export function useGlobalStore<K extends keyof IGlobalState>(selector: K): IGlobalState[K] {
    return store((state) => state[selector]);
}
