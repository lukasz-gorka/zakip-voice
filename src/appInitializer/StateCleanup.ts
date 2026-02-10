import {IGlobalState} from "./store/interfaces/IGlobalState.ts";

export class StateCleanup {
    public static cleanEphemeralState(state: IGlobalState): Partial<IGlobalState> {
        return {
            ...state,
            provider: state.provider,
            globalShortcuts: state.globalShortcuts,
            voice: {
                ...state.voice,
                isRecording: false,
                isEnhancing: false,
                isTranscribing: false,
            },
        };
    }
}
