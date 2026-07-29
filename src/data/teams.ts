import type { AttributeId } from './elements';

/**
 * The three Guard Teams offered after the Quiet Crossing boss (plan §5.4).
 * Picking one sets the player's team attribute and their first own creature.
 */

export interface GuardTeam {
  id: string;
  name: string;
  attribute: AttributeId;
  /** Key into HUMANS in assets/art.ts. */
  leaderArt: string;
  leaderName: string;
  starter: string;
  color: string;
  pitch: string;
  perk: string;
}

export const TEAMS: GuardTeam[] = [
  {
    id: 'gold',
    name: 'Gold Guard',
    attribute: 'hero',
    leaderArt: 'leaderGold',
    leaderName: 'Warden Vance',
    starter: 'emberling',
    color: '#ffd166',
    pitch: 'We hold the line and we log everything. Order first, questions later.',
    perk: 'Hero team — steadier defence.',
  },
  {
    id: 'blue',
    name: 'Blue Guard',
    attribute: 'mage',
    leaderArt: 'leaderBlue',
    leaderName: 'Analyst Cira',
    starter: 'glidefang',
    color: '#6fb7ff',
    pitch: 'Read the reach before you step into it. Adapt, then act.',
    perk: 'Mage team — faster turn order.',
  },
  {
    id: 'black',
    name: 'Black Guard',
    attribute: 'assassin',
    leaderArt: 'leaderBlack',
    leaderName: 'Handler Skull',
    starter: 'nightnip',
    color: '#c77dff',
    pitch: 'The corrupt sectors need someone willing to go in dirty. That is us.',
    perk: 'Assassin team — heavier offence.',
  },
];

export function team(id: string): GuardTeam {
  const t = TEAMS.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown team: ${id}`);
  return t;
}
