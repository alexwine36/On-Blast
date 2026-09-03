import type { AudioEngine, AudioStatus } from "./types";

/** The real hit, lifted from the sketch. Falls back to the synth if it fails to load. */
export const STING_SAMPLE_URL: string | null = "/audio/sting.wav";

export function createWebAudioEngine(): AudioEngine {
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.7;
  // Safety limiter: the synth stack and any future sample both land here, and
  // a sting that clips sounds cheap.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.15;
  master.connect(limiter);
  limiter.connect(ctx.destination);

  let sample: AudioBuffer | null = null;
  if (STING_SAMPLE_URL) {
    void fetch(STING_SAMPLE_URL)
      .then((r) => r.arrayBuffer())
      .then((b) => ctx.decodeAudioData(b))
      .then((buf) => { sample = buf; })
      .catch((err) => console.error("[audio] sting sample failed to load", err));
  }

  // ---- Shoulder drone -------------------------------------------------
  // Built once and left running with its gain at zero. Starting and stopping
  // oscillators per gesture would click; riding the gain does not.
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0;
  const droneFilter = ctx.createBiquadFilter();
  droneFilter.type = "lowpass";
  droneFilter.frequency.value = 700;
  droneFilter.Q.value = 6;
  droneGain.connect(droneFilter);
  droneFilter.connect(master);

  const droneOscs = [-7, 5].map((detune) => {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 110;
    osc.detune.value = detune;
    osc.connect(droneGain);
    osc.start();
    return osc;
  });

  const DRONE_LOW_HZ = 110;   // A2, shoulders down
  const DRONE_OCTAVES = 2;    // up to A4
  const DRONE_LEVEL = 0.16;

  function setDrone(active: boolean, pitch: number): void {
    const p = Math.max(0, Math.min(1, pitch));
    const t = ctx.currentTime;
    const freq = DRONE_LOW_HZ * Math.pow(2, p * DRONE_OCTAVES);
    // setTargetAtTime glides instead of stepping, which is what keeps this from
    // sounding like a stair-step as the pose updates ~30 times a second.
    for (const osc of droneOscs) osc.frequency.setTargetAtTime(freq, t, 0.06);
    // Open the filter as it rises so higher notes get brighter, not just higher.
    droneFilter.frequency.setTargetAtTime(500 + p * 2600, t, 0.08);
    droneGain.gain.setTargetAtTime(active ? DRONE_LEVEL : 0, t, active ? 0.08 : 0.15);
  }

  function playSample(buffer: AudioBuffer): void {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(master);
    src.start();
  }

  /**
   * Placeholder sting: a three-note ascending stab on detuned saws with a
   * filter sweep, plus a noise crash. Stands in until a real sample is chosen.
   */
  function playSynthSting(): void {
    const t0 = ctx.currentTime + 0.01;
    // An ascending figure landing on a held major chord.
    const runNotes = [392.0, 523.25, 659.25]; // G4 C5 E5
    const chord = [523.25, 659.25, 783.99]; // C5 E5 G5

    const bus = ctx.createGain();
    bus.gain.value = 0.28;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, t0);
    filter.frequency.exponentialRampToValueAtTime(5200, t0 + 0.16);
    filter.frequency.exponentialRampToValueAtTime(1400, t0 + 0.9);
    bus.connect(filter);
    filter.connect(master);

    const voice = (freq: number, start: number, dur: number, detune: number) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(1, start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(g);
      g.connect(bus);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    };

    runNotes.forEach((f, i) => {
      const start = t0 + i * 0.075;
      voice(f, start, 0.14, -6);
      voice(f, start, 0.14, +6);
    });

    const landing = t0 + runNotes.length * 0.075;
    for (const f of chord) {
      voice(f, landing, 0.75, -8);
      voice(f, landing, 0.75, +8);
    }
    voice(130.81, landing, 0.8, 0); // C3 root underneath

    // Cymbal-ish crash on the landing.
    const noiseLen = Math.floor(ctx.sampleRate * 0.6);
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen) ** 2;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 5000;
    const ng = ctx.createGain();
    ng.gain.value = 0.28;
    noise.connect(hp);
    hp.connect(ng);
    ng.connect(master);
    noise.start(landing);
  }

  return {
    get source(): "sample" | "synth" {
      return sample ? "sample" : "synth";
    },
    get status(): AudioStatus {
      if (ctx.state === "running") return "ready";
      return ctx.state === "suspended" ? "blocked" : "idle";
    },
    async unlock() {
      if (ctx.state !== "running") await ctx.resume();
    },
    setDrone,
    playSting() {
      if (ctx.state !== "running") void ctx.resume();
      if (sample) playSample(sample);
      else playSynthSting();
    },
    dispose() {
      for (const osc of droneOscs) {
        try {
          osc.stop();
        } catch {
          // already stopped
        }
      }
      void ctx.close();
    },
  };
}
