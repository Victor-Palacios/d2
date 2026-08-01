import type { DialogueScript } from '../systems/dialogue/script';
import { narrate, say } from '../systems/dialogue/script';

/**
 * Recruits — story companions met and joined **mid-crawl**, where their story
 * actually lives, instead of arriving back at the hub. A `recruit` FloorEvent
 * (see `dungeon.ts`) plays the scene once and calls `game.joinCompanion`.
 *
 * Wren still joins at the Everwake (the opening), and Sena Vale is met inside
 * the Reliquary and follows you home after her boundary falls — so the only one
 * who *joins* in the field is Kade, found deep in the Unremembered. Adding
 * another is a data entry here plus a `recruit` tile in some floor.
 */
export interface Recruit {
  id: string;
  /** Display name, for the join toast. */
  name: string;
  /** Companion species built via `makeCreature`. */
  speciesId: string;
  level: number;
  /** Run flag set on join (and its dedupe guard — matches the hub fallback). */
  flag: string;
  /** Spoken when you find them. The last line should read as them falling in. */
  script: DialogueScript;
}

export const RECRUITS: Record<string, Recruit> = {
  // Kade — the rival who was "always a reach ahead." The surprise is where you
  // finally catch him: not triumphant at the hub, but stopped cold near the
  // bottom of the Unremembered, beside the very thing he spent years outrunning.
  kade: {
    id: 'kade',
    name: 'Kade',
    speciesId: 'kade',
    level: 8,
    flag: 'kadeJoined',
    script: [
      ...narrate(
        'A lantern sits on the cold floor of the nave, still lit, its owner nowhere near it. Then you see him — Kade, the fastest keeper they had, sitting in the dark with his back to a wall, not moving at all.',
      ),
      ...say(
        'Kade',
        `You. Of course it is you. I ran three reaches to stay ahead of everyone, and the one who catches up is the one I never worried about.`,
      ),
      ...say(
        'Kade',
        'I always took the next reach first so I would never have to stand still long enough to feel any of it. The Unremembered caught me standing still. There is a name in here I have been outrunning for years, and down there it finally said mine back.',
      ),
      ...say(
        'Kade',
        'I am done running it. I cannot go on alone and I will not go back. Let me keep pace with you instead.',
      ),
      ...narrate(
        'Kade picks his lantern up off the floor. Its flame steadies next to yours — one more keeper, one more soul that can answer the call.',
      ),
    ],
  },
};

export function recruit(id: string): Recruit {
  const r = RECRUITS[id];
  if (!r) throw new Error(`Unknown recruit: ${id}`);
  return r;
}
