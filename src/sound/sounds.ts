import {Logger} from "../logger/Logger.ts";
import {NotificationSoundName} from "./const/NotificationSoundName.ts";

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

const playChord = (frequencies: number[], duration: number, volume: number = 0.08): void => {
    frequencies.forEach((freq) => playBeep(freq, duration, volume));
};

const playSequence = (notes: Array<{frequency: number; delay: number; duration: number}>, volume: number = 0.1): void => {
    notes.forEach(({frequency, delay, duration}) => {
        setTimeout(() => playBeep(frequency, duration, volume), delay);
    });
};

export const playNotificationSound = (soundType: NotificationSoundName = NotificationSoundName.COMPLETE): void => {
    try {
        switch (soundType) {
            case NotificationSoundName.NONE:
                return;

            case NotificationSoundName.SUCCESS:
                playChord([523, 659, 784], 0.15, 0.06);
                break;

            case NotificationSoundName.COMPLETE:
                playBeep(800, 0.1, 0.3);
                break;

            case NotificationSoundName.ATTENTION:
                playSequence(
                    [
                        {frequency: 1000, delay: 0, duration: 0.08},
                        {frequency: 1000, delay: 120, duration: 0.08},
                    ],
                    0.2,
                );
                break;

            case NotificationSoundName.BELL:
                playSequence(
                    [
                        {frequency: 1200, delay: 0, duration: 0.15},
                        {frequency: 800, delay: 80, duration: 0.2},
                    ],
                    0.15,
                );
                break;

            case NotificationSoundName.CHIME:
                playSequence(
                    [
                        {frequency: 400, delay: 0, duration: 0.12},
                        {frequency: 600, delay: 100, duration: 0.12},
                        {frequency: 800, delay: 200, duration: 0.15},
                    ],
                    0.15,
                );
                break;

            case NotificationSoundName.GENTLE:
                playBeep(400, 0.2, 0.08);
                break;

            case NotificationSoundName.ALERT:
                playSequence(
                    [
                        {frequency: 1500, delay: 0, duration: 0.06},
                        {frequency: 1500, delay: 80, duration: 0.06},
                        {frequency: 1500, delay: 160, duration: 0.1},
                    ],
                    0.2,
                );
                break;

            default:
                playBeep(800, 0.1, 0.3);
        }
    } catch (error) {
        Logger.error("[Sounds] Failed to play notification sound:", {error, data: {soundType}});
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
