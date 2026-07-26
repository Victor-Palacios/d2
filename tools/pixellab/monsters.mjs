// Registry of monster sprite specs for the PixelLab pipeline.
// One place to define what each monster looks like; generate.mjs reads it.
// Full workflow + prompt rules: docs/adding-monsters.md.
//
// Every spec is { palette: string[], size: number, prompt: string }.
//   - palette: the small on-brand colour set (<=6 hex). It is BOTH forced on
//     the API (via a swatch image) and used to snap the PNG back to a clean
//     sprite in png-to-pixelart.mjs, so a line stays on-palette end to end.
//   - size:    square generation size in px (48-64 is the sweet spot).
//   - prompt:  the text prompt, always ending with STYLE + a tone clause.

// Shared style clause — the constant that makes the whole roster read as one.
export const STYLE = "clean single-color black outline, flat shading, front view, symmetrical";

// ---------------------------------------------------------------------------
// Standardized evolution ladder.  Wisp -> Shade -> Revenant -> Beyond.
// STAGE vibes are creature-agnostic; `line()` slots a creature's theme in.
// ---------------------------------------------------------------------------
export const STAGES = {
  wisp:     { vibe: "a small round chibi creature, oversized head, tiny stubby body, short limbs, big cute glowing eyes, harmless endearing and a little mischievous", tone: "cute charming dark-fantasy RPG creature sprite", size: 48 },
  shade:    { vibe: "a lean upright adolescent creature, slender body, small budding horns and claws, sly toothy grin, mildly menacing and agile", tone: "spooky dark-fantasy RPG monster sprite", size: 56 },
  revenant: { vibe: "a gaunt towering demon, tall imposing silhouette, long ragged tattered wings, curved horns, long clawed fingers, fanged snarl, menacing sinister pose", tone: "evil dark-fantasy RPG boss monster sprite", size: 64 },
  beyond:   { vibe: "a colossal godlike demon overlord, ornate terrifying final form, massive spread wings, crown of horns, glowing runes, radiating dark energy, awe-inspiring and regal", tone: "epic dark-fantasy RPG final-boss monster sprite", size: 64 },
};

/** Expand a creature line into per-stage monster entries (`<id>-<stage>`). */
export function line(id, theme, palette) {
  const out = {};
  for (const [stage, s] of Object.entries(STAGES)) {
    out[`${id}-${stage}`] = { palette, size: s.size, prompt: `${s.vibe}, ${theme}, ${STYLE}, ${s.tone}` };
  }
  return out;
}

export const MONSTERS = {
  // --- Evolution lines ----------------------------------------------------
  // Nightnip's demonic bat line: Wisp -> Shade -> Revenant -> Beyond.
  ...line(
    "nightnip",
    "a dark violet-black bat-demon, leathery membrane bat wings, big amber eyes, impish devil motif",
    ["#1a1024", "#6b4d9e", "#f2e8ff", "#ffd166", "#3c2b5c"],
  ),

  // --- Standalone monsters (no ladder) — write the full prompt directly ----
  // The Last Light: a soul almost ready to move on, a trembling flame in a
  // cracked lantern with little ash legs. Fragile and sorrowful, not scary.
  lastlight: {
    palette: ["#141018", "#4a4660", "#9a93b0", "#ff8a3c", "#ffe8a8"],
    size: 64,
    prompt:
      "a tiny trembling warm candle flame glowing softly inside a small cracked black iron lantern, " +
      "little wispy legs made of drifting grey ash and smoke, fragile ghostly and sorrowful, timid, " +
      `${STYLE}, melancholic dark-fantasy RPG spirit sprite`,
  },
};
