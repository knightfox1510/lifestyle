/**
 * This device's feedback preferences (sound off, vibration on by default),
 * and a soft synthesised "tick" for confirmations. Browser-only; every access
 * is guarded so a blocked localStorage or missing audio just means silence.
 */
const SOUND = "hearth.feedback.sound";
const HAPTICS = "hearth.feedback.haptics";

const read = (k: string, fallback: boolean) => {
  try {
    const v = localStorage.getItem(k);
    return v == null ? fallback : v === "1";
  } catch {
    return fallback;
  }
};
const write = (k: string, on: boolean) => {
  try {
    localStorage.setItem(k, on ? "1" : "0");
  } catch {
    /* ignore */
  }
};

export const soundOn = () => read(SOUND, false);
export const hapticsOn = () => read(HAPTICS, true);
export const setSoundOn = (on: boolean) => write(SOUND, on);
export const setHapticsOn = (on: boolean) => write(HAPTICS, on);

let ctx: AudioContext | null = null;

/**
 * A short, quiet two-note tick: rising for a real log ("done!"), a single soft
 * note for small saves, falling for an error.
 */
export function playTick(kind: "log" | "save" | "error" = "save") {
  if (!soundOn()) return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    const notes = kind === "log" ? [880, 1318.5] : kind === "error" ? [440, 330] : [1046.5];
    const t0 = ctx.currentTime;
    notes.forEach((f, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      const t = t0 + i * 0.075;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.07, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.14);
    });
  } catch {
    /* no sound */
  }
}
