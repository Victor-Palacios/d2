/**
 * Cutscenes — scripted, non-interactive "memory" beats (the Option-A design:
 * see the narrative discussion). A cutscene is pure data: an ordered list of
 * beats, each a line or two of centred prose held for a beat, with an optional
 * colour wash that grades the mood. `playCutscene` (src/ui/Cutscene.ts) renders
 * them over whatever HD-2D diorama is already mounted — letterboxed, tinted, and
 * skippable — so no new scene or art is needed (CLAUDE.md: asset-free).
 *
 * The camera drift is whatever the host scene is already doing (the title
 * diorama, for the prologue, breathes on its own), so a beat carries no camera
 * of its own here; a richer player can add keyframes later without touching this
 * data. Fire one from any scene: `await playCutscene(ctx.ui, cutscene(id), …)`.
 */
export interface CutsceneBeat {
  /** One or two short lines of prose, shown centred. Kept terse — this reads. */
  lines: string[];
  /** How long the text holds, in ms, before it fades to the next beat. */
  hold?: number;
  /**
   * A full-screen colour wash for this beat (hex), crossfaded in as the beat
   * begins. This is the whole mood-grade: warm for life, cold for the dark.
   */
  tint?: string;
}

export interface Cutscene {
  id: string;
  /** A soft hint shown once, so the player knows they may skip. */
  skipHint?: string;
  beats: CutsceneBeat[];
}

export const CUTSCENES: Record<string, Cutscene> = {
  // The prologue flashback: how the keeper lived, and how they died — ~10s,
  // played the moment they are named, before Halden welcomes them in. The wash
  // warms for the life, cools as it ends, and drains to the Everwake's own fog
  // colour so the memory dissolves straight into the present dark.
  prologueLife: {
    id: 'prologueLife',
    skipHint: 'press any button to skip',
    beats: [
      {
        lines: ['Before the lantern, before the dark —', 'there was a life. Ordinary. Yours.'],
        tint: '#4a2f12',
        hold: 2600,
      },
      {
        lines: ['A window that caught the morning.', 'A voice from the next room.'],
        tint: '#5a3a16',
        hold: 2600,
      },
      {
        lines: ['A hand you always meant', 'to hold a little longer.'],
        tint: '#40331c',
        hold: 2600,
      },
      {
        lines: ['Then a day like any other,', 'that was not.'],
        tint: '#2a2b3a',
        hold: 2400,
      },
      {
        lines: ['And then — quiet.', 'And a lantern, put into your hands.'],
        tint: '#14161f',
        hold: 3000,
      },
    ],
  },
};

export function cutscene(id: string): Cutscene {
  const c = CUTSCENES[id];
  if (!c) throw new Error(`Unknown cutscene: ${id}`);
  return c;
}
