"use client";

import { useSyncExternalStore } from "react";

/**
 * The page's sound kit. Everything is synthesised on a shared AudioContext —
 * the same decision the disc's chime already made: nothing to download,
 * nothing to license, and every sound is a dozen tweakable numbers rather
 * than a wav baked in a designer's DAW.
 *
 * The palette is papery and glittery to match the scrapbook: filtered noise
 * for anything that touches paper (picking up, scribbling), soft sine pops
 * for UI, and little pentatonic pings for anything worth celebrating.
 *
 * Every sound here fires off the back of a user gesture, which is what keeps
 * browser autoplay policies happy — the context is created and resumed inside
 * the very first click it is asked to voice.
 */

// --- mute, persisted -------------------------------------------------------
const KEY = "todobingo:muted";

let muted = false;
let loaded = false;
let listeners: (() => void)[] = [];

const notify = () => listeners.forEach((listener) => listener());

const readMuted = () => {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

const subscribe = (onChange: () => void) => {
  listeners = [...listeners, onChange];
  return () => {
    listeners = listeners.filter((listener) => listener !== onChange);
  };
};

const getSnapshot = () => {
  if (!loaded) {
    loaded = true;
    muted = readMuted();
  }
  return muted;
};

export const useMuted = () =>
  useSyncExternalStore(subscribe, getSnapshot, () => false);

export const setMuted = (next: boolean) => {
  muted = next;
  loaded = true;
  try {
    window.localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    /* sound preference is not worth an error surface */
  }
  notify();
};

// --- the instrument --------------------------------------------------------
let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

/**
 * Real recordings for the sounds worth being real — dropped into /public/sfx
 * and decoded once into the same context the synth voices play through. Until
 * a recording has loaded (or if it ever fails to), the synthesised version of
 * the same sound plays instead, so nothing is ever silent.
 */
const SAMPLES = {
  click: "/sfx/freesound_community-macbook-pro-touchpad-clicking-90343.mp3",
  cdTray: "/sfx/freesound_community-opening-closing-cd-dvd-blu-ray-player-31074.mp3",
  whistle: "/sfx/freesound_community-party-whistle-being-blown-79410.mp3",
  pencil: "/sfx/freesound_community-pencil-29272.mp3",
  eraser: "/sfx/freesound_community-pencil-eraser-erasing-71215.mp3",
} as const;

type SampleName = keyof typeof SAMPLES;

const samples: Partial<Record<SampleName, AudioBuffer>> = {};
let samplesRequested = false;

const preloadSamples = (c: AudioContext) => {
  if (samplesRequested) return;
  samplesRequested = true;
  (Object.keys(SAMPLES) as SampleName[]).forEach((name) => {
    void fetch(SAMPLES[name])
      .then((response) =>
        response.ok
          ? response.arrayBuffer()
          : Promise.reject(new Error(String(response.status))),
      )
      .then((data) => c.decodeAudioData(data))
      .then((buffer) => {
        samples[name] = buffer;
      })
      .catch(() => {
        /* missing or undecodable recording — the synth stands in forever */
      });
  });
};

const context = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  if (getSnapshot()) return null;

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;

  try {
    if (!ctx) ctx = new Ctor();
    // iOS parks the context until a gesture; every sound here is one.
    if (ctx.state === "suspended") void ctx.resume();
    preloadSamples(ctx);
    return ctx;
  } catch {
    return null;
  }
};

/** Plays a recording if it has arrived. False means: use the synth instead. */
const playSample = (
  name: SampleName,
  opts?: { gain?: number; rate?: number },
): boolean => {
  const c = context();
  if (!c) return false;
  const buffer = samples[name];
  if (!buffer) return false;

  const src = c.createBufferSource();
  src.buffer = buffer;
  if (opts?.rate) src.playbackRate.value = opts.rate;

  const amp = c.createGain();
  amp.gain.value = opts?.gain ?? 1;

  src.connect(amp).connect(c.destination);
  src.start();
  return true;
};

/**
 * A recording looped as a friction voice: loudness follows the hand's speed,
 * and the playback rate leans with it, so the real pencil recording still
 * hisses harder on a fast scribble.
 */
const sampleFriction = (name: SampleName, maxGain: number): Friction | null => {
  const c = context();
  if (!c) return null;
  const buffer = samples[name];
  if (!buffer) return null;

  const src = c.createBufferSource();
  src.buffer = buffer;
  src.loop = true;

  const amp = c.createGain();
  amp.gain.value = 0.0001;

  src.connect(amp).connect(c.destination);
  src.start();

  return {
    move: (speed: number) => {
      const t = c.currentTime;
      const s = Math.min(Math.max(speed, 0), 1);
      amp.gain.setTargetAtTime(maxGain * s, t, 0.05);
      src.playbackRate.setTargetAtTime(0.85 + 0.4 * s, t, 0.08);
    },
    end: () => {
      const t = c.currentTime;
      amp.gain.setTargetAtTime(0.0001, t, 0.04);
      src.stop(t + 0.3);
    },
  };
};

/** One second of white noise, built once — the raw material for paper. */
const noise = (c: AudioContext): AudioBuffer => {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
};

/** A sine (or other) blip, optionally gliding between two pitches. */
const tone = (opts: {
  freq: number;
  to?: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
  delay?: number;
}) => {
  const c = context();
  if (!c) return;

  const at = c.currentTime + (opts.delay ?? 0);
  const osc = c.createOscillator();
  const amp = c.createGain();

  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, at);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, at + opts.dur);

  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(opts.gain, at + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + opts.dur);

  osc.connect(amp).connect(c.destination);
  osc.start(at);
  osc.stop(at + opts.dur + 0.05);
};

/** A burst of bandpassed noise, gliding its centre — paper, slides, scrubs. */
const scrub = (opts: {
  from: number;
  to: number;
  dur: number;
  gain: number;
  delay?: number;
  q?: number;
}) => {
  const c = context();
  if (!c) return;

  const at = c.currentTime + (opts.delay ?? 0);
  const src = c.createBufferSource();
  const band = c.createBiquadFilter();
  const amp = c.createGain();

  src.buffer = noise(c);
  band.type = "bandpass";
  band.Q.value = opts.q ?? 1.4;
  band.frequency.setValueAtTime(opts.from, at);
  band.frequency.exponentialRampToValueAtTime(opts.to, at + opts.dur);

  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(opts.gain, at + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + opts.dur);

  src.connect(band).connect(amp).connect(c.destination);
  src.start(at);
  src.stop(at + opts.dur + 0.05);
};

/**
 * A continuous friction voice for tools that rub the paper: looped noise
 * through a bandpass whose loudness and brightness follow the hand's speed.
 * The caller feeds it movement and ends it with the stroke — a fixed-length
 * sample here would either cut off mid-stroke or drone on after it.
 */
export type Friction = { move: (speed: number) => void; end: () => void };

const friction = (opts: {
  low: number;
  high: number;
  gain: number;
  q?: number;
  /** A faint tonal squeak layered over the noise — rubber, not graphite. */
  squeak?: number;
}): Friction | null => {
  const c = context();
  if (!c) return null;

  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.loop = true;

  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = opts.q ?? 1;
  band.frequency.value = opts.low;

  const amp = c.createGain();
  amp.gain.value = 0.0001;

  src.connect(band).connect(amp).connect(c.destination);
  src.start();

  let osc: OscillatorNode | null = null;
  let squeakAmp: GainNode | null = null;
  if (opts.squeak) {
    osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = opts.squeak;
    squeakAmp = c.createGain();
    squeakAmp.gain.value = 0.0001;
    osc.connect(squeakAmp).connect(c.destination);
    osc.start();
  }

  const move = (speed: number) => {
    const t = c.currentTime;
    const s = Math.min(Math.max(speed, 0), 1);
    amp.gain.setTargetAtTime(opts.gain * s, t, 0.04);
    band.frequency.setTargetAtTime(opts.low + (opts.high - opts.low) * s, t, 0.06);
    if (osc && squeakAmp) {
      squeakAmp.gain.setTargetAtTime(0.018 * s, t, 0.05);
      // The squeak wanders a little, the way rubber catches and slips.
      osc.frequency.setTargetAtTime(
        (opts.squeak ?? 0) * (0.92 + Math.random() * 0.16),
        t,
        0.08,
      );
    }
  };

  const end = () => {
    const t = c.currentTime;
    amp.gain.setTargetAtTime(0.0001, t, 0.04);
    squeakAmp?.gain.setTargetAtTime(0.0001, t, 0.04);
    src.stop(t + 0.3);
    osc?.stop(t + 0.3);
  };

  return { move, end };
};

/** High pentatonic pitches the sparkles are drawn from. */
const GLITTER = [2093, 2637, 3136, 3951, 4699];
/** A lower, rounder set for the letter beads. */
const BEADS = [523.25, 587.33, 659.25, 783.99, 880];

// --- the sounds ------------------------------------------------------------
export const sfx = {
  /** The quiet dry tick under every button press — a real touchpad click,
      pitched slightly differently every time so it never sounds mechanical. */
  tick: () => {
    if (playSample("click", { gain: 0.5, rate: 0.94 + Math.random() * 0.12 }))
      return;
    tone({ freq: 1850 + Math.random() * 250, dur: 0.035, gain: 0.05 });
  },

  /** A panel arriving (up) or leaving (down). */
  pop: (open: boolean) => {
    tone(
      open
        ? { freq: 280, to: 540, dur: 0.09, gain: 0.11 }
        : { freq: 520, to: 250, dur: 0.09, gain: 0.09 },
    );
  },

  /** Paper lifting off the page — a task row, a sticker off its shelf. */
  pickup: () => {
    scrub({ from: 700, to: 2300, dur: 0.12, gain: 0.09 });
  },

  /** Landing somewhere that matters: a soft thock with a paper tap. */
  drop: () => {
    tone({ freq: 175, to: 88, dur: 0.1, gain: 0.16 });
    scrub({ from: 2600, to: 1200, dur: 0.05, gain: 0.05, delay: 0.008 });
  },

  /** Pencil scrubbing a square or a row out — matches the strike animation. */
  scribble: () => {
    for (let i = 0; i < 3; i += 1) {
      scrub({
        from: 1100 + Math.random() * 500,
        to: 2100 + Math.random() * 600,
        dur: 0.09,
        gain: 0.07,
        delay: i * 0.095,
        q: 2.2,
      });
    }
  },

  /** The glitter cling: staggered high pings with a shimmer double. */
  sparkle: (count = 4) => {
    for (let i = 0; i < count; i += 1) {
      const freq = GLITTER[Math.floor(Math.random() * GLITTER.length)];
      const delay = i * 0.045;
      tone({ freq, dur: 0.32, gain: 0.055, delay });
      tone({ freq: freq * 1.006, dur: 0.26, gain: 0.03, delay: delay + 0.012 });
    }
  },

  /** Celebration, sized like the confetti itself is. A completed line earns
      the real party whistle; a single task keeps the smaller synth pop. */
  confetti: (pieces: number) => {
    const big = pieces > 100;
    if (big && playSample("whistle", { gain: 0.4 })) {
      sfx.sparkle(6);
      return;
    }
    tone({ freq: 330, to: 560, dur: 0.1, gain: 0.12 });
    if (big) tone({ freq: 140, to: 70, dur: 0.16, gain: 0.14, delay: 0.02 });
    sfx.sparkle(big ? 8 : 4);
  },

  /** Something being removed: two quick falling ticks. */
  snip: () => {
    tone({ freq: 2100, dur: 0.04, gain: 0.06 });
    tone({ freq: 1400, dur: 0.05, gain: 0.05, delay: 0.06 });
  },

  /** One letter bead clacking — pitched by its place in the name. */
  bead: (index: number) => {
    tone({
      freq: BEADS[index % BEADS.length],
      dur: 0.13,
      gain: 0.11,
      type: "triangle",
    });
    scrub({ from: 3200, to: 2200, dur: 0.03, gain: 0.05 });
  },

  /** The export's camera moment: ka-chik. */
  shutter: () => {
    tone({ freq: 2400, dur: 0.03, gain: 0.07 });
    scrub({ from: 3600, to: 900, dur: 0.05, gain: 0.07, delay: 0.05 });
    tone({ freq: 1300, dur: 0.04, gain: 0.06, delay: 0.09 });
  },

  /** The disc winding up. Its landing chime lives with the disc itself. */
  whirr: () => {
    scrub({ from: 320, to: 1500, dur: 0.4, gain: 0.07 });
  },

  /** One typewriter tap per keystroke; backspace taps lower. */
  key: (backspace = false) => {
    tone({
      freq: backspace ? 950 : 1450 + Math.random() * 550,
      dur: 0.03,
      gain: 0.035,
    });
    scrub({ from: 4200, to: 2800, dur: 0.02, gain: 0.028 });
  },

  /** Graphite on paper, alive for the length of the stroke — the real
      pencil recording when it has loaded, the synth hiss until then. */
  pencil: (): Friction | null =>
    sampleFriction("pencil", 0.55) ??
    friction({ low: 2200, high: 5200, gain: 0.05, q: 0.7 }),

  /** Rubber on paper — the real eraser recording, synth squeak as fallback. */
  eraser: (): Friction | null =>
    sampleFriction("eraser", 0.7) ??
    friction({ low: 260, high: 760, gain: 0.1, q: 1.3, squeak: 1050 }),

  /** The disc sliding in or out — an actual CD tray. */
  cdTray: () => {
    if (playSample("cdTray", { gain: 0.5 })) return;
    tone({ freq: 280, to: 540, dur: 0.09, gain: 0.11 });
  },
};
