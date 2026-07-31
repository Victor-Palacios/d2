import type { ElementId } from './elements';
import type { EnemySpec } from './dungeon';
import type { DialogueScript } from '../systems/dialogue/script';
import { narrate, say } from '../systems/dialogue/script';

/**
 * The Anchored.
 *
 * Most souls cross. A few are too heavy with a single feeling to lift — rage,
 * grief, longing, fear — and instead of passing they sink into a reach and take
 * root there, radiating that one feeling across a great mass of element tiles
 * until the ground itself burns, or freezes, or greens, or goes dark. They are
 * not echoes to be quieted in a turn. They are anchors, and an unprepared keeper
 * cannot budge them.
 *
 * Mechanically these are optional super-encounters (Octopath-style), one per
 * reach except the last:
 *
 * - They sit on a prominent 4x4 element mass, so the field is drenched in their
 *   element. In battle that mass buffs your matching-element souls — so the way
 *   through is a leveled, element-matched (or element-savvy) team.
 * - They are tuned well above the reach's recommended level, so a first-visit
 *   party loses or flees. That is intended: an Anchored is a reason to come back.
 * - They are NOT consumed by defeat or flight (see `DungeonScene.runEvent`), so
 *   you can return and try again. Only victory marks them, grants their Memento
 *   (once), and sets the `anchored:<reach>` flag.
 *
 * All of that data lives here; the scene code is generic. See docs/NARRATIVE.md
 * §11d and docs/SYSTEMS.md.
 */
export interface Anchored {
  id: string;
  /** Reach this Anchored is sunk into (key into REACHES). */
  reachId: string;
  /** Its name, e.g. "The Unquenched". */
  name: string;
  /** The one feeling that could not cross — flavour, shown in the intro. */
  feeling: string;
  /** The element it radiates across its tile mass. */
  element: ElementId;
  /** The tough, element-matched roster. Tuned above the reach's level. */
  enemies: EnemySpec[];
  /** Spoken as you step onto the mass, before the fight. */
  intro: DialogueScript;
  /** Memento granted once, on the first time you unmoor it. */
  reward: string;
  /** One-line flavour on the victory that frees it to cross. */
  victory: string;
}

export const ANCHORED: Record<string, Anchored> = {
  // --- The Quiet Crossing — rage / fire -----------------------------------
  crossingAnchored: {
    id: 'crossingAnchored',
    reachId: 'crossing',
    name: 'The Unquenched',
    feeling: 'a rage that would not be put out',
    element: 'fire',
    enemies: [
      { species: 'cinderfang', level: 4 },
      { species: 'emberling', level: 3 },
    ],
    intro: [
      ...narrate(
        'The floor here is not stone but coals — a wide bed of them, still burning after who knows how long. In the middle of the heat, a soul that did not so much refuse to cross as forget there was anywhere else to go but hotter.',
      ),
      ...say(
        'Halden',
        'That is an Anchored. It went into the dark angry and never spent it, and now it holds this whole floor down with it. You will not win by outlasting it — it does not tire. Come at it matched to the fire, or come back when you are stronger.',
      ),
    ],
    reward: 'emberVigil',
    victory: 'The coals go grey. The rage, at last, is only warmth — and warmth rises. The Unquenched crosses.',
  },

  // --- The Reliquary — grief / water --------------------------------------
  crystalAnchored: {
    id: 'crystalAnchored',
    reachId: 'crystal',
    name: 'The Unweeping',
    feeling: 'a grief that froze before it could fall',
    element: 'water',
    enemies: [
      { species: 'glaciark', level: 6 },
      { species: 'tidecaller', level: 5 },
    ],
    intro: [
      ...narrate(
        'A lake of black ice fills the vault, and the cold coming off it is grief you can feel in your teeth. Something is kept at the centre of it — kept, and keeping, the way the whole Reliquary is.',
      ),
      ...say(
        'Sena Vale',
        'It never cried. It just went cold and stayed. I know the shape of that. Bring water to water, and enough of it — or leave it, and grow into the fight. It is not going anywhere. That is the whole problem with it.',
      ),
    ],
    reward: 'stillTears',
    victory:
      'The ice gives one long crack, and then it weeps — all of it, all at once. The Unweeping melts, and is gone.',
  },

  // --- The Overgrowth — longing / nature ----------------------------------
  jungleAnchored: {
    id: 'jungleAnchored',
    reachId: 'jungle',
    name: 'The Unyielding',
    feeling: 'a longing so deep it took root',
    element: 'nature',
    enemies: [
      { species: 'verdanox', level: 7 },
      { species: 'direfang', level: 6 },
    ],
    intro: [
      ...narrate(
        'The green here is not growing — it is holding on. Vines thick as arms wrap something at the heart of the tangle, and every one of them is pulling inward, toward a soul that wanted so badly to stay that it became the staying.',
      ),
      ...say(
        'Kade',
        'It is not guarding the way. It is not even fighting, really. It is just refusing to let go, and it has gotten very strong at it. You go in soft, it holds you too. Match the green, or come back rooted deeper yourself.',
      ),
    ],
    reward: 'longRoot',
    victory:
      'The vines loosen, one finger at a time, like a hand deciding at last that it can. The Unyielding lets go, and lifts.',
  },

  // --- The Unremembered — fear / dark -------------------------------------
  hauntedAnchored: {
    id: 'hauntedAnchored',
    reachId: 'haunted',
    name: 'The Unwitnessed',
    feeling: 'a fear of being forgotten, hidden until it was',
    element: 'dark',
    enemies: [
      { species: 'revenance', level: 9 },
      { species: 'banshade', level: 8 },
    ],
    intro: [
      ...narrate(
        'The dark here is not empty — it is crowded, packed tight with a soul that hid so no one could lose it, and in hiding was lost anyway. It has been alone with that a long time, and it has grown teeth.',
      ),
      ...say(
        'Wren',
        'It is afraid of exactly one thing: being seen and then let go. Which is the only thing that frees it. Bring the dark to meet it — or bring more of yourself, and come back. I will hold its name until you can.',
      ),
    ],
    reward: 'seenAtLast',
    victory:
      'You look straight at it — all of it, the whole hidden shape — and instead of vanishing, it steadies. Witnessed, the Unwitnessed can finally go.',
  },
};

export function anchored(id: string): Anchored {
  const a = ANCHORED[id];
  if (!a) throw new Error(`Unknown Anchored: ${id}`);
  return a;
}

/** Run-flag set once an Anchored has been unmoored (per reach). */
export const anchoredFlag = (reachId: string): string => `anchored:${reachId}`;
