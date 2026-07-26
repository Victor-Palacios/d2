// Registry of monster sprite specs for the PixelLab pipeline — the CANONICAL
// record of how every monster was generated. Any monster we make is defined
// here (prompt + palette), so its prompt can always be looked up later.
// generate.mjs reads this. Full workflow + rules: docs/adding-monsters.md.
//
// Every spec is { palette: string[], size: number, prompt: string }.
//   - palette: the small on-brand colour set (<=6 hex). Forced on the API and
//     reused to snap the PNG back to a clean on-roster sprite.
//   - size:    square generation size. STANDARD = 64px for all art (see SIZE).
//   - prompt:  text prompt, always ending with STYLE + a tone clause.

// Shared style clause — the constant that makes the whole roster read as one.
export const STYLE = "clean single-color black outline, flat shading, front view, symmetrical";

// Standard generation size. We generate (and convert) ALL art at 64px as we
// migrate the roster to PixelLab sprites. Change here to move the whole roster.
export const SIZE = 64;

// ---------------------------------------------------------------------------
// Standardized evolution ladder.  Wisp -> Shade -> Revenant -> Beyond.
// STAGE vibes are creature-agnostic; `line()` slots a creature's theme in.
// ---------------------------------------------------------------------------
export const STAGES = {
  wisp:     { vibe: "a small round chibi creature, oversized head, tiny stubby body, short limbs, big cute glowing eyes, harmless endearing and a little mischievous", tone: "cute charming dark-fantasy RPG creature sprite" },
  shade:    { vibe: "a lean upright adolescent creature, slender body, small budding horns and claws, sly toothy grin, mildly menacing and agile", tone: "spooky dark-fantasy RPG monster sprite" },
  revenant: { vibe: "a gaunt towering demon, tall imposing silhouette, long ragged tattered wings, curved horns, long clawed fingers, fanged snarl, menacing sinister pose", tone: "evil dark-fantasy RPG boss monster sprite" },
  beyond:   { vibe: "a colossal godlike demon overlord, ornate terrifying final form, massive spread wings, crown of horns, glowing runes, radiating dark energy, awe-inspiring and regal", tone: "epic dark-fantasy RPG final-boss monster sprite" },
};

/** Expand a creature line into per-stage monster entries (`<id>-<stage>`). */
export function line(id, theme, palette) {
  const out = {};
  for (const [stage, s] of Object.entries(STAGES)) {
    out[`${id}-${stage}`] = { palette, size: SIZE, prompt: `${s.vibe}, ${theme}, ${STYLE}, ${s.tone}` };
  }
  return out;
}

const NIGHTNIP_THEME = "a dark violet-black bat-demon, leathery membrane bat wings, big amber eyes, impish devil motif";
const NIGHTNIP_PALETTE = ["#1a1024", "#6b4d9e", "#f2e8ff", "#ffd166", "#3c2b5c"];

// The Last Light — a soul almost ready to move on: a flame in a cracked lantern.
const LASTLIGHT_PALETTE = ["#14121c", "#4a4660", "#cfccdf", "#8a8fd6", "#e8e6f5", "#ffd97a"];

export const MONSTERS = {
  // --- Evolution lines ----------------------------------------------------
  // Nightnip's demonic bat line: Wisp -> Shade -> Revenant -> Beyond.
  // (nightnip-wisp is the shipped rookie; it records that sprite's prompt.)
  ...line("nightnip", NIGHTNIP_THEME, NIGHTNIP_PALETTE),

  // --- The Last Light: three very different takes on the same concept ------
  // A: cute wax candle-ghost with a soft flame, cradled in a cracked lantern.
  "lastlight-candle": {
    palette: LASTLIGHT_PALETTE,
    size: SIZE,
    prompt:
      "a small round cute candle spirit, soft pale melting wax body with little wax drips, " +
      "a sweet simple face with one big round glowing eye and a tiny smile, topped by a gentle " +
      "teardrop blue-violet flame, cradled in a small cracked black lantern, soft and ghostly, " +
      `${STYLE}, cute charming dark-fantasy RPG spirit sprite`,
  },
  // B: the lantern itself is alive — a shy sooty lantern-creature with a soul inside.
  "lastlight-lantern": {
    palette: LASTLIGHT_PALETTE,
    size: SIZE,
    prompt:
      "a small cracked black iron lantern that is alive, tiny glowing amber eyes and a shy little " +
      "face in its sooty glass, a warm soul-flame flickering inside, stubby ember legs and tiny " +
      "arms, hunched and timid, " +
      `${STYLE}, melancholic dark-fantasy RPG spirit sprite`,
  },
  // C: an ethereal flame-wisp escaping the broken lantern.
  "lastlight-wisp": {
    palette: LASTLIGHT_PALETTE,
    size: SIZE,
    prompt:
      "a wispy ghostly blue-violet flame spirit with a faint sorrowful face and a trailing smoky " +
      "tail, rising out of a broken cracked black lantern at its base, ethereal weightless and " +
      "fading away, " +
      `${STYLE}, ethereal melancholic dark-fantasy RPG spirit sprite`,
  },
};
