/**
 * The Immortality set (death theme — the Last Light reward). Each piece is a
 * line of Mary Elizabeth Frye's elegy "Do not stand at my grave and weep"
 * (widely treated as out of copyright; see docs/NARRATIVE.md §8). Pieces are
 * awarded in order, one per soul released, until all twelve are collected —
 * then the Immortality Memento unlocks.
 */
export const IMMORTALITY_POEM: readonly string[] = [
  'Do not stand at my grave and weep,',
  'I am not there, I do not sleep.',
  'I am a thousand winds that blow;',
  'I am the diamond glints on the snow.',
  'I am the sunlight on ripened grain;',
  "I am the gentle autumn's rain.",
  "When you awaken in the morning's hush,",
  'I am the swift uplifting rush',
  'Of quiet birds in circled flight.',
  'I am the soft star that shines at night.',
  'Do not stand at my grave and cry.',
  'I am not there; I did not die.',
];

export const IMMORTALITY_TOTAL = IMMORTALITY_POEM.length;

/** Twenty things one might say to a spirit that has lost something. */
export const COMFORT_PHRASES: readonly string[] = [
  "I'm sorry for what you've lost.",
  'You were loved. I can tell.',
  "It's alright to be tired.",
  'You do not have to hold on for me.',
  'Whatever it was, it was not your fault.',
  'You carried it a long way. You can set it down.',
  'Someone waited up for you, once.',
  'You mattered. You still do.',
  'The dark is not angry with you.',
  'Rest is not the same as forgetting.',
  'You are allowed to stop looking.',
  'I will remember, so you do not have to.',
  'There is no wrong way to leave.',
  'You kept your promise. It is enough.',
  'The ones you miss are not far now.',
  'You were braver than you were told.',
  'Let the cold go. It was never yours.',
  'Nothing is asking anything of you anymore.',
  'You can let the light be small.',
  'It is a good night to go home.',
];
