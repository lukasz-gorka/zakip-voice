import {IGlobalState} from "./global/interfaces/IGlobalState.ts";
import {store} from "./index.ts";

export abstract class StoreManager<K extends keyof IGlobalState> {
    protected readonly storeKey: K;

    constructor(storeKey: K) {
        this.storeKey = storeKey;
    }

    public state = (): IGlobalState[K] => {
        return store.getState()[this.storeKey];
    };

    protected updateState = (newDataOrFunction: Partial<IGlobalState[K]> | ((section: IGlobalState[K], state: IGlobalState) => IGlobalState[K])) => {
        store.setState((state: IGlobalState) => ({
            ...state,
            [this.storeKey]:
                typeof newDataOrFunction === "function"
                    ? newDataOrFunction(state[this.storeKey], state)
                    : {
                          ...state[this.storeKey],
                          ...newDataOrFunction,
                      },
        }));
    };
}
