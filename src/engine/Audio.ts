/**
 * Placeholder audio, synthesised with the Web Audio API.
 *
 * Like the art, none of this is sampled from anywhere — every sound is a few
 * oscillators and an envelope, so the repo stays asset-free (plan §0.2). Swap
 * `sfx()`/`music()` for a Howler-backed implementation to use real audio.
 */

type SfxName =
  | 'blip'
  | 'confirm'
  | 'cancel'
  | 'step'
  | 'bump'
  | 'chest'
  | 'pickup'
  | 'portal'
  | 'hit'
  | 'crit'
  | 'guard'
  | 'heal'
  | 'ko'
  | 'encounter'
  | 'victory'
  | 'defeat';

interface Note {
  freq: number;
  time: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
}

const SFX: Record<SfxName, Note[]> = {
  blip: [{ freq: 660, time: 0, dur: 0.05, type: 'square', gain: 0.12 }],
  confirm: [
    { freq: 620, time: 0, dur: 0.06, type: 'square', gain: 0.14 },
    { freq: 930, time: 0.05, dur: 0.09, type: 'square', gain: 0.14 },
  ],
  cancel: [
    { freq: 400, time: 0, dur: 0.06, type: 'square', gain: 0.12 },
    { freq: 260, time: 0.05, dur: 0.09, type: 'square', gain: 0.12 },
  ],
  step: [{ freq: 150, time: 0, dur: 0.05, type: 'triangle', gain: 0.09 }],
  bump: [{ freq: 90, time: 0, dur: 0.1, type: 'sawtooth', gain: 0.12 }],
  chest: [
    { freq: 700, time: 0, dur: 0.07, type: 'square', gain: 0.12 },
    { freq: 880, time: 0.07, dur: 0.07, type: 'square', gain: 0.12 },
    { freq: 1170, time: 0.14, dur: 0.16, type: 'square', gain: 0.12 },
  ],
  pickup: [
    { freq: 520, time: 0, dur: 0.05, type: 'square', gain: 0.11 },
    { freq: 780, time: 0.05, dur: 0.1, type: 'square', gain: 0.11 },
  ],
  portal: [
    { freq: 220, time: 0, dur: 0.5, type: 'sine', gain: 0.16 },
    { freq: 330, time: 0.12, dur: 0.45, type: 'sine', gain: 0.12 },
    { freq: 440, time: 0.24, dur: 0.4, type: 'sine', gain: 0.1 },
  ],
  hit: [{ freq: 180, time: 0, dur: 0.12, type: 'sawtooth', gain: 0.16 }],
  crit: [
    { freq: 240, time: 0, dur: 0.14, type: 'sawtooth', gain: 0.2 },
    { freq: 120, time: 0.06, dur: 0.2, type: 'square', gain: 0.16 },
  ],
  guard: [{ freq: 300, time: 0, dur: 0.14, type: 'triangle', gain: 0.13 }],
  heal: [
    { freq: 780, time: 0, dur: 0.09, type: 'sine', gain: 0.14 },
    { freq: 1040, time: 0.08, dur: 0.16, type: 'sine', gain: 0.12 },
  ],
  ko: [
    { freq: 320, time: 0, dur: 0.12, type: 'sawtooth', gain: 0.16 },
    { freq: 160, time: 0.1, dur: 0.26, type: 'sawtooth', gain: 0.14 },
  ],
  encounter: [
    { freq: 200, time: 0, dur: 0.1, type: 'square', gain: 0.16 },
    { freq: 300, time: 0.1, dur: 0.1, type: 'square', gain: 0.16 },
    { freq: 200, time: 0.2, dur: 0.1, type: 'square', gain: 0.16 },
    { freq: 420, time: 0.3, dur: 0.3, type: 'square', gain: 0.16 },
  ],
  victory: [
    { freq: 523, time: 0, dur: 0.11, type: 'square', gain: 0.14 },
    { freq: 659, time: 0.11, dur: 0.11, type: 'square', gain: 0.14 },
    { freq: 784, time: 0.22, dur: 0.11, type: 'square', gain: 0.14 },
    { freq: 1046, time: 0.33, dur: 0.34, type: 'square', gain: 0.15 },
  ],
  defeat: [
    { freq: 392, time: 0, dur: 0.18, type: 'triangle', gain: 0.14 },
    { freq: 330, time: 0.18, dur: 0.18, type: 'triangle', gain: 0.14 },
    { freq: 262, time: 0.36, dur: 0.5, type: 'triangle', gain: 0.14 },
  ],
};

/**
 * Monster "cries" — each creature's own voice, like a Pokémon/Digimon call.
 *
 * A cry is a short stack of oscillator layers. Unlike a flat `Note`, a layer can
 * *glide* its pitch (`f0`→`f1`) and carry `vibrato` (an LFO on frequency), which
 * is what lets a handful of oscillators read as a growl, a coo or a screech
 * instead of a beep. Keyed by species id; a species with no entry stays silent.
 */
interface CryLayer {
  /** Start frequency. */
  f0: number;
  /** Glide-to frequency by the end of the layer (defaults to `f0`, i.e. steady). */
  f1?: number;
  time: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  /** `[rate Hz, depth Hz]` — a frequency wobble that gives the voice character. */
  vibrato?: [rate: number, depth: number];
  /** Pitch-ramp shape. `exp` (default) sounds natural; `lin` is more mechanical. */
  glide?: 'lin' | 'exp';
}

const CRIES: Record<string, CryLayer[]> = {
  // Emberling (fire lizard): a low, rough rising snarl that spits upward at the
  // end — fast wide vibrato on a sawtooth reads as a guttural growl.
  emberling: [
    { f0: 240, f1: 380, time: 0, dur: 0.16, type: 'sawtooth', gain: 0.17, vibrato: [34, 22] },
    { f0: 180, f1: 300, time: 0.02, dur: 0.14, type: 'square', gain: 0.06, vibrato: [55, 18] },
    { f0: 520, f1: 760, time: 0.15, dur: 0.1, type: 'sawtooth', gain: 0.13 },
  ],
  // Glidefang (water/wind flier): an airy coo that lifts, then rides a long
  // descending glide — soft triangle/sine with a slow vibrato.
  glidefang: [
    { f0: 720, f1: 1020, time: 0, dur: 0.12, type: 'triangle', gain: 0.14, vibrato: [12, 14] },
    { f0: 1020, f1: 640, time: 0.11, dur: 0.22, type: 'sine', gain: 0.13, vibrato: [16, 20] },
    { f0: 1400, f1: 1180, time: 0.12, dur: 0.16, type: 'sine', gain: 0.05 },
  ],
  // Nightnip (dark bat): a quick, high, chittery screech — two fluttering chirps
  // and a sharp rising tail, rapid vibrato throughout.
  nightnip: [
    { f0: 900, f1: 1180, time: 0, dur: 0.06, type: 'square', gain: 0.12, vibrato: [70, 40] },
    { f0: 1180, f1: 820, time: 0.06, dur: 0.06, type: 'square', gain: 0.12, vibrato: [70, 40] },
    { f0: 1000, f1: 1500, time: 0.12, dur: 0.11, type: 'sawtooth', gain: 0.1, vibrato: [90, 30] },
  ],
};

export type MusicTrack = 'hub' | 'dungeon' | 'battle' | 'boss' | 'crystal' | 'haunted' | 'jungle' | null;

/** Simple looping bass/arp patterns, one per mood. Semitone offsets from root. */
const TRACKS: Record<Exclude<MusicTrack, null>, { root: number; bpm: number; bass: number[]; arp: number[] }> = {
  hub: { root: 174.6, bpm: 96, bass: [0, 0, 7, 5], arp: [12, 16, 19, 16, 12, 19, 24, 19] },
  dungeon: { root: 130.8, bpm: 84, bass: [0, 0, -2, 3], arp: [12, 15, 19, 15, 12, 19, 22, 19] },
  battle: { root: 146.8, bpm: 148, bass: [0, 0, 5, 3], arp: [12, 15, 19, 24, 19, 15, 12, 15] },
  boss: { root: 110, bpm: 160, bass: [0, -1, 0, -3], arp: [12, 13, 19, 20, 12, 13, 24, 20] },
  // Crystal Cavern: bright, airy, major — a high shimmering arp over a slow root.
  crystal: { root: 164.8, bpm: 80, bass: [0, 4, 7, 4], arp: [19, 24, 28, 24, 19, 24, 31, 28] },
  // Haunted Dungeon: low, minor, unsettled — a dragging tritone-leaning bass.
  haunted: { root: 98, bpm: 72, bass: [0, 0, -1, -6], arp: [12, 15, 18, 15, 12, 18, 15, 11] },
  // The Overgrowth: warm, loping, major-pentatonic — a humid, rolling groove.
  jungle: { root: 138.6, bpm: 104, bass: [0, 3, 5, 3], arp: [12, 14, 17, 21, 17, 14, 12, 17] },
};

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private timer: number | null = null;
  private step = 0;
  private track: MusicTrack = null;
  muted = false;
  /** Overall level — placeholder audio should never be loud. */
  volume = 0.5;

  /** Browsers require a user gesture before audio can start. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.34;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 1;
    this.sfxGain.connect(this.master);
    if (this.track) this.music(this.track);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    return this.muted;
  }

  private tone(note: Note, dest: GainNode, when: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = note.type ?? 'square';
    osc.frequency.setValueAtTime(note.freq, when);
    const peak = note.gain ?? 0.12;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + note.dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(when);
    osc.stop(when + note.dur + 0.02);
  }

  sfx(name: SfxName) {
    if (!this.ctx || !this.sfxGain) return;
    const t0 = this.ctx.currentTime;
    for (const n of SFX[name]) this.tone(n, this.sfxGain, t0 + n.time);
  }

  /** One gliding, optionally-vibrato'd oscillator layer of a monster cry. */
  private voiceLayer(l: CryLayer, dest: GainNode, when: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = l.type ?? 'sawtooth';
    const f1 = l.f1 ?? l.f0;
    osc.frequency.setValueAtTime(l.f0, when);
    if (f1 !== l.f0) {
      if ((l.glide ?? 'exp') === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), when + l.dur);
      else osc.frequency.linearRampToValueAtTime(f1, when + l.dur);
    }
    // Vibrato: a sine LFO summed into the oscillator's frequency.
    if (l.vibrato) {
      const [rate, depth] = l.vibrato;
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(rate, when);
      lfoGain.gain.setValueAtTime(depth, when);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(when);
      lfo.stop(when + l.dur + 0.02);
    }
    const peak = l.gain ?? 0.12;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + l.dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(when);
    osc.stop(when + l.dur + 0.02);
  }

  /**
   * Play a monster's battle cry — its own voice, the way a Pokémon or Digimon
   * calls out when it appears or strikes. No-op for a species without a cry, so
   * callers can fire it unconditionally.
   */
  cry(speciesId: string) {
    if (!this.ctx || !this.sfxGain) return;
    const voice = CRIES[speciesId];
    if (!voice) return;
    const t0 = this.ctx.currentTime;
    for (const l of voice) this.voiceLayer(l, this.sfxGain, t0 + l.time);
  }

  /** Species ids that currently have an authored cry. */
  hasCry(speciesId: string): boolean {
    return speciesId in CRIES;
  }

  music(track: MusicTrack) {
    this.track = track;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (!track || !this.ctx || !this.musicGain) return;
    const t = TRACKS[track];
    const stepMs = 60000 / t.bpm / 2;
    this.step = 0;
    this.timer = window.setInterval(() => {
      if (!this.ctx || !this.musicGain || this.muted) return;
      const now = this.ctx.currentTime + 0.02;
      const s = this.step++;
      const bass = t.bass[Math.floor(s / 4) % t.bass.length];
      if (s % 4 === 0) {
        this.tone(
          { freq: t.root * Math.pow(2, bass / 12) * 0.5, time: 0, dur: stepMs / 700, type: 'triangle', gain: 0.16 },
          this.musicGain,
          now,
        );
      }
      const arp = t.arp[s % t.arp.length];
      this.tone(
        { freq: t.root * Math.pow(2, (arp + bass) / 12), time: 0, dur: stepMs / 1100, type: 'square', gain: 0.05 },
        this.musicGain,
        now,
      );
    }, stepMs);
  }
}

export const audio = new AudioEngine();
