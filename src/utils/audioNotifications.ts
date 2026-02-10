import {Logger} from "../logger/Logger.ts";

declare global {
    interface Window {
        webkitAudioContext?: typeof AudioContext;
    }
}

let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
    if (!audioContext || audioContext.state === "closed") {
        const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextConstructor) {
            throw new Error("AudioContext not supported");
        }
        audioContext = new AudioContextConstructor();
    }
    if (audioContext.state === "suspended") {
        audioContext.resume();
    }
    return audioContext;
};

const playBeep = (frequency: number, duration: number, volume: number = 0.1): void => {
    try {
        const ctx = getAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = "sine";

        gainNode.gain.setValueAtTime(volume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

        oscillator.onended = () => {
            oscillator.disconnect();
            gainNode.disconnect();
        };

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration);
    } catch (error) {
        Logger.error("[Sounds] Failed to play beep:", {error});
    }
};

export const playStartSound = (): void => {
    playBeep(800, 0.1, 0.05);
};

export const playStopSound = (): void => {
    playBeep(400, 0.1, 0.05);
};

export const playCopySound = (): void => {
    playBeep(600, 0.05, 0.03);
};
