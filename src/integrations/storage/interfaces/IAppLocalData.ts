import {IGlobalState} from "../../../appInitializer/store/global/interfaces/IGlobalState.ts";

export type IAppLocalData = {
    meta: {
        version: number;
        lastUpdated: string;
    };
} & Partial<IGlobalState>;

export const createDefaultAppData = (): IAppLocalData => ({
    meta: {
        version: 0,
        lastUpdated: new Date().toISOString(),
    },
});
