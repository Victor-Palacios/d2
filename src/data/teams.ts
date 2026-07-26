import type { AttributeId } from './elements';

/**
 * The three Guard Teams offered after the Boot Domain boss (plan §5.4).
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
    attribute: 'alpha',
    leaderArt: 'leaderGold',
    leaderName: 'Warden Vance',
    starter: 'emberling',
    color: '#ffd166',
    pitch: 'We hold the line and we log everything. Order first, questions later.',
    perk: 'Alpha team bonus — steadier defence.',
  },
  {
    id: 'blue',
    name: 'Blue Guard',
    attribute: 'beta',
    leaderArt: 'leaderBlue',
    leaderName: 'Analyst Cira',
    starter: 'glidefang',
    color: '#6fb7ff',
    pitch: 'Read the domain before you drive into it. Adapt, then act.',
    perk: 'Beta team bonus — faster turn order.',
  },
  {
    id: 'black',
    name: 'Black Guard',
    attribute: 'gamma',
    leaderArt: 'leaderBlack',
    leaderName: 'Handler Skull',
    starter: 'nightnip',
    color: '#c77dff',
    pitch: 'The corrupt sectors need someone willing to go in dirty. That is us.',
    perk: 'Gamma team bonus — heavier offence.',
  },
];

export function team(id: string): GuardTeam {
  const t = TEAMS.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown team: ${id}`);
  return t;
}
