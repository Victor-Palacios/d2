// Registry of monster sprite specs for the PixelLab pipeline — the CANONICAL
// record of how every monster was generated. Any monster we make is defined
// here (prompt + palette), so its prompt can always be looked up later.
// generate.mjs reads this. Full workflow + rules: docs/adding-monsters.md.
//
// Every spec is { palette: string[], size: number, prompt: string }.
//   - palette: a small on-brand colour HINT (<=6 hex) forced on the API to keep
//     the render on-brand. The converter (png-to-pixelart.mjs) then derives its
//     own adaptive palette (up to ~48 colours) from the render — so this is a
//     hint, not the final sprite palette.
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
//
// RULE: the wisp (rookie) stage MUST be cute/charming — an endearing mascot,
// never generic or scary. Follow the cute-creature recipe (creature-framed,
// big eyes + face, material as a surface, cute-charming tone). See
// docs/adding-monsters.md. Later stages/bosses may be cooler or menacing.
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

  // --- The Last Light: a soul almost ready to move on. Chosen design: the cute
  // wax candle-ghost with a soft flame, cradled in a cracked lantern.
  // (Explored alternates: a living lantern and an escaping flame-wisp — dropped.)
  lastlight: {
    palette: LASTLIGHT_PALETTE,
    size: SIZE,
    prompt:
      "a small round cute candle spirit, soft pale melting wax body with little wax drips, " +
      "a sweet simple face with one big round glowing eye and a tiny smile, topped by a gentle " +
      "teardrop blue-violet flame, cradled in a small cracked black lantern, soft and ghostly, " +
      `${STYLE}, cute charming dark-fantasy RPG spirit sprite`,
  },

  // --- Roster migration: existing species reimagined at 64px ---------------
  // Ids are the art.ts CREATURES keys, so each art.txt pastes straight in.
  // Palettes are the sprites' current on-brand hints (from art.ts).
  lizard: { palette: ["#2a1408", "#f07f2a", "#ffe08a", "#1a1a2e", "#ff5a2a", "#ffd23f"], size: SIZE,
    prompt: `a small cute fire lizard rookie, round body, stubby legs, a little flame flickering on its tail, big friendly eyes, warm and spunky, ${STYLE}, cute charming dark-fantasy RPG creature sprite` },
  wing: { palette: ["#141a28", "#79c8e8", "#e8f6ff", "#ffffff", "#132033", "#3f7fa8"], size: SIZE,
    prompt: `a small winged sky-mammal rookie, big soft membrane wings, fluffy round body, big curious eyes, breezy and light, ${STYLE}, cute charming dark-fantasy RPG creature sprite` },
  plant: { palette: ["#12240f", "#7ec850", "#f2f7a0", "#3f8f3a", "#ffffff"], size: SIZE,
    prompt: `a small plant sprout creature, round leafy bulb body, a budding sprout and little leaves on its head, big gentle eyes, earthy and cheerful, ${STYLE}, cute charming dark-fantasy RPG creature sprite` },
  bot: { palette: ["#101319", "#9aa7bd", "#ffd166", "#dff3ff", "#39e0ff"], size: SIZE,
    prompt: `a small cute round creature with a smooth rounded metal shell, big glowing cyan eyes and a tiny happy face, a little antenna, tidy and earnest, ${STYLE}, cute charming dark-fantasy RPG creature sprite` },
  slime: { palette: ["#0d2436", "#3fb6e8", "#cdf3ff"], size: SIZE,
    prompt: `a small cute water-slime blob, translucent rounded jelly body, a glossy highlight, tiny happy face, wobbly and calm, ${STYLE}, cute charming dark-fantasy RPG creature sprite` },
  wisp: { palette: ["#100a1c", "#4a3670", "#c77dff"], size: SIZE,
    prompt: `a small cute round will-o-wisp creature, soft round wispy shadow body, big glowing violet eyes and a tiny face, little trailing wisps, curious and mischievous, ${STYLE}, cute spooky charming dark-fantasy RPG creature sprite` },
  knight: { palette: ["#111420", "#b9c3d6", "#6fd3ff", "#3a5fa8", "#ffd166"], size: SIZE,
    prompt: `a small cute round armored knight-creature, smooth rounded steel shell, a glowing visor with big friendly eyes, tiny stubby arms, brave and steadfast, ${STYLE}, cute charming dark-fantasy RPG creature sprite` },
  wolf: { palette: ["#18140f", "#8d8f9c", "#e8e4d8", "#ffffff", "#ffd166"], size: SIZE,
    prompt: `a small cute round wolf-pup creature, fluffy round body, big bright eyes and a tiny fanged grin, little pointed ears and a bushy tail, spirited and swift, ${STYLE}, cute charming dark-fantasy RPG creature sprite` },
  bug: { palette: ["#1b1608", "#a8892f", "#ffe08a", "#2b1a05"], size: SIZE,
    prompt: `a small cute round beetle-creature, smooth rounded shell, big sparkly eyes and a tiny smile, little stubby legs and tiny antennae, shy and gentle, ${STYLE}, cute charming dark-fantasy RPG creature sprite` },
  scrap: { palette: ["#141821", "#7d8798", "#ffd166", "#ff6b6b"], size: SIZE,
    prompt: `a small cute round creature with a smooth patched scrap-metal shell, big glowing eyes and a tiny face, one little bolt antenna, plucky and earnest, ${STYLE}, cute charming dark-fantasy RPG creature sprite` },
  crystalSlime: { palette: ["#0e2a33", "#3fd0e6", "#bff4ff", "#0b1a20", "#8fecff"], size: SIZE,
    prompt: `a small cute round crystal-slime creature, translucent gem body with soft facets, big sparkly eyes and a tiny smile, glinting, calm and shy, ${STYLE}, cute charming dark-fantasy RPG creature sprite` },
  prismMoth: { palette: ["#241a3a", "#7fb0ff", "#d6e6ff", "#ffd1f0", "#101024", "#fff2a8"], size: SIZE,
    prompt: `a small cute round moth creature, fluffy round body with big soft wings, big shiny eyes and a tiny face, feathery antennae, gentle and flighty, ${STYLE}, cute charming dark-fantasy RPG creature sprite` },
  geodeGolem: { palette: ["#1c1522", "#5b5168", "#7d7189", "#a065ff", "#e0c0ff", "#0a0810"], size: SIZE,
    prompt: `a small cute round rocky creature, mossy stone shell with a glowing crystal on its chest, big friendly eyes and a tiny face, stubby limbs, sturdy and calm, ${STYLE}, cute charming dark-fantasy RPG creature sprite` },
  wraithWisp: { palette: ["#161226", "#8f7fb8", "#e6dcff", "#c86bff"], size: SIZE,
    prompt: `a small cute round ghost creature, soft pale spectral body with a wispy tail, big glowing hollow eyes and a tiny shy face, drifting, lonely but sweet, ${STYLE}, spooky charming dark-fantasy RPG creature sprite` },
  graveCrawler: { palette: ["#12180f", "#5e7a3a", "#9fc45a", "#ff606b", "#c9d98a"], size: SIZE,
    prompt: `a small cute round grub creature, soft rounded mossy body, big round glowing eyes and a tiny face, little stubby legs, timid and grimy, ${STYLE}, spooky charming dark-fantasy RPG creature sprite` },
  cursedArmor: { palette: ["#0f1420", "#48506b", "#6b7590", "#c86bff", "#9fb0d8"], size: SIZE,
    prompt: `a small cute round haunted-armor creature, rounded battered helmet body, a soft glowing violet face with big eyes inside the visor, tiny gauntlet hands, spooky but loyal, ${STYLE}, spooky charming dark-fantasy RPG creature sprite` },
  lion: { palette: ["#241304", "#e8a33c", "#d8c49a", "#fff0cf", "#2b1a05", "#ffffff"], size: SIZE,
    prompt: `a majestic maned lion boss beast, huge flowing golden mane, powerful regal body, blazing eyes, proud and commanding, ${STYLE}, epic dark-fantasy RPG boss monster sprite` },
  crystalWarden: { palette: ["#08222b", "#39c6e0", "#b6f2ff", "#7fe8ff", "#eaffff", "#ffffff"], size: SIZE,
    prompt: `a towering ice-crystal warden boss, tall angular crystalline body, a glowing frost core, radiant jagged shards, imposing and cold, ${STYLE}, epic dark-fantasy RPG boss monster sprite` },
  revenant: { palette: ["#120e20", "#6a5c92", "#d8ccff", "#c86bff", "#ff5a7a"], size: SIZE,
    prompt: `a large spectral revenant boss, tall looming wraith, glowing violet eyes, a tattered flowing shroud, ominous crimson aura, ${STYLE}, epic dark-fantasy RPG boss monster sprite` },
};
