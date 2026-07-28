# The Everwake — a game about what we refuse to let go

*A narrative reconstruction of the first three domains and the opening, pivoting
the project from a monster-collecting dungeon-crawler to a meditation on death.
This is the full report of the choices made, grounded in
`docs/designing-a-video-game-about-death` (the design framework the owner
supplied). Written to be read as the game's story bible.*

> **Why this pivot works:** the mechanics were already about death; the story
> just hadn't said so. A **Soularium** is a book of the remembered. **Soul
> Syphon** is the act of drawing a lingering soul into your keeping. **The Last
> Light** is a soul almost ready to move on. Renaming the fiction lets the
> systems finally mean what they do.

---

## 1. What kind of death this is about

Per the framework (§2.2), a game needs **two** primary meanings of death and one
optional secondary. Chosen:

- **Primary — Grief:** responding to the death of another.
- **Primary — The Second Death:** the disappearance of a person from living
  memory (§2.1). When the last person who remembers you forgets, you die again,
  and for good.
- **Secondary — Legacy:** what we keep of the dead, and what that keeping costs.

## 2. The dramatic question (§3)

> **Is preserving someone's memory an act of love, or an inability to release
> them?**

Every system answers it. To **syphon** a soul is to keep it — with you, in your
lantern, out of its rest. To **log** it in the Soularium is to save it from the
Second Death — by refusing to let it fade. The player is never told which is
right. The game asks it again and again with different faces.

**Thesis (§18.1 template):**

> The game explores whether *holding on to the dead* becomes *devotion* or
> *captivity* when the only way to keep someone is to refuse them rest.

Acceptance is not the "correct" answer and defiance is not the villain (§17.3).
Keeping a soul saves it from oblivion. Releasing it ends a person who might still
have been remembered. Both are love; both cost.

## 3. The world

**The Everwake** — the hub — is a perpetual wake: a waystation lit against the
dark where lingering souls gather before they cross, and where the living who
cannot let go come to keep them. It never sleeps because grief doesn't. (The
name predates this pivot and fits so exactly it is kept.)

The "domains" are not dungeons of data but **reaches of the lingering** — places
where the dead have not moved on, each for a different reason. What the old build
called *monsters* are **echoes**: souls still running their last routine (§, the
old Haunted blurb already said this). You do not kill data. You meet the
lingering. A downed echo is *quieted*, not slain. To syphon one is to take it
into your keeping — to save it, and to hold it.

**The protagonist is The Unfinished (§5.1).** They carry a warden's lantern
because they cannot rest until they finish one thing: finding the soul they
lost. Competent, driven, emotionally evasive. The player names them and, through
play, decides what "unfinished" finally means — and whether finishing is the
same as living. Their philosophy is deliberately unstable at the start (§5.1
design warning), so the companions don't feel like lectures.

## 4. The cast — characters who join the journey

Four distinct **relationships with death** (§1.1, a 4-hour experimental scope),
each with a gameplay verb (§9) and a non-death desire (§6.1).

| Character | Role (framework) | Relationship to death | Verb | Non-death desire |
|---|---|---|---|---|
| **The player** | The Unfinished (§5.1) | "I cannot rest until I finish." | **Choose** | to be told they can stop |
| **Halden** | The Custodian (§5.4) | "Death is a responsibility we owe each other." | **Tend / Release** | terrible detective serials |
| **Sena Vale** | The Defier (§5.2) | "Letting go is just a prettier word for losing." | **Preserve** | she used to sing; won't now |
| **Wren** | The Bereaved Witness (§5.7) | "Forgetting them is the real death. I keep the list." | **Remember** | wants, absurdly, to win a footrace |
| **The Last Light** | The Exhausted (§5.6) | "I would like, please, to stop." | **(is released)** | to be understood before it goes |

- **Halden** is the recast mentor (kept from the old build for continuity). Once
  "Dr. Halden," now the keeper of The Everwake's wake — the one who teaches you
  that acceptance is not passivity but the hardest labor in the game (§5.4): how
  to sit with a soul, hear its name, and let it cross. He is calm, understated,
  and privately terrified that if he felt every loss he has tended, he would
  collapse. He reads pulp mysteries on the radio between souls.
- **Sena Vale** is the warden of the second domain (below). She froze her
  sister's soul so it could never fade — and can never leave. She is not a
  villain; she *saved* someone (§5.2 necessary contradiction). Her verb,
  Preserve, keeps things exactly as they were, which is also why nothing can heal.
- **Wren** keeps the Soularium — literally the Bereaved Witness's list of names
  against the Second Death (§5.7). Wren fears that healing will erase the dead,
  and makes the living compete with them. Wren's arc questions whether the list
  is love or a cage.
- **The Last Light** is the Exhausted made small and rare: a trembling
  candle-flame in a cracked lantern, a soul almost ready to move on. It is not
  recruitable and cannot be kept — it can only be *understood and released*. It
  is the game's thesis compressed into one encounter (see §6).

**Companion souls (the starter bond).** The three first companions you may bond
with — reskinned from the old starters — are three lingering souls with
different unfinished business, so even the tutorial states the theme:

- **Emberling → "the Ember"** — a soul that burned bright and went out angry;
  lingers on unspent heat. (Hero / fire.)
- **Nightnip → "the Nightnip"** — a soul that hid from its own ending; quick,
  evasive, funny (a small Avoider, §5.3). (Assassin / dark.)
- **Glidefang → "the Glidefang"** — a soul at peace, riding the drafts, waiting
  without fear (a small Pilgrim, §5.5). (Mage / water.)

## 5. The first three reaches (dungeons)

The framework's opening structure (§11.1–11.3): **death at a distance**, then
**every philosophy is useful**, then **every philosophy hardens**. Each reach
reflects one idea from the framework and hosts one relationship with death.

### Reach I — The Quiet Crossing *(tutorial; name kept)*
- **Idea:** *Death at a distance* (§11.1). The Unfinished believes they already
  understand loss — they carry a lantern, they know the drill. The Crossing
  teaches otherwise.
- **What it is:** the threshold every soul passes on its way to rest — quiet
  because most cross without trouble. You learn to meet an echo, to hear it, to
  quiet or keep it. Halden guides you by radio.
- **Boundary keeper (boss):** **the Vigil** (recast of Regalion, §5.8 Version G —
  the Boundary Keeper). It does not attack out of malice; it blocks the way to
  see whether you are fit to carry a lantern deeper. Beating it earns not a
  "licence" but a **keeper's leave**.
- **Relationship hosted:** the Custodian (Halden).

### Reach II — The Reliquary *(was Crystal Cavern)*
- **Idea:** *Preservation becomes stagnation* (§11.3); the Dorian-Gray / Kept
  Light motif (§13.10, §15.4 vanitas). Is preserving a person the same as
  keeping them?
- **What it is:** a supercooled hall where souls are held in perfect glass so
  they will never fade. Nothing decays here. Nothing heals here either. The
  echoes are memories frozen mid-gesture, repeating one bright moment forever.
- **Warden (boss):** **Sena Vale**, who froze her sister **Lire** to spare her
  the Second Death — and cannot now let the ice melt. Her fight is grief refusing
  to end (§8.1, the Defier vs. the Custodian: *cure versus care*). Defeating her
  is not killing her; it is convincing her to open her hand.
- **Relationship hosted:** the Defier (Sena) — she *did* save Lire; that is the
  contradiction that keeps her human.

### Reach III — The Unremembered *(was Haunted Dungeon)*
- **Idea:** *The Second Death* (§2.1). Souls here are fading because the living
  stopped saying their names. They run their last errands over and over, thinner
  each time.
- **What it is:** a corrupted, dimming sector — Lethe's reach. The echoes are
  the nearly-forgotten. To log one in the Soularium is, literally, to save it
  from a second, final death — the Bereaved Witness's whole crusade (§5.7).
- **The keystone (rare encounter):** **The Last Light** — a soul that *wants* to
  go, and asks only to be understood first (full spec in §6). It is the
  Metal-Slime slot re-imagined: not "kill it before it flees," but "learn how to
  release it."
- **Warden (boss):** **the Unnamed** (recast of Revenance) — a soul so utterly
  forgotten it has forgotten itself; a wound where a person used to be. You
  cannot restore who it was. You can only give it *a* name, or let it go nameless.
- **Relationship hosted:** the Bereaved Witness (Wren) and the Exhausted (the
  Last Light).

> **Reaches unlock in story order.** The world map gates each reach behind the
> one before it (data-driven, `Domain.requires`): The Quiet Crossing is always
> open; clearing it opens The Reliquary; clearing the Reliquary opens The
> Unremembered *and* the optional Overgrowth. A locked reach shows greyed on the
> map with a "clear ___ first" hint, so the intended path — and the fact that
> there is more — reads at a glance.

### An optional reach — The Overgrowth *(a side path)*
- **Idea:** *Keeping mistaken for company* — the dramatic question at a smaller,
  quieter scale than the main line. Not on the mission spine; a green detour off
  the map (recommended ~Lv7), open whenever the player wanders to it.
- **What it is:** a warm, humid reach that never gives anything back — souls who
  stopped to rest were quietly rooted where they sat. The echoes (Frondle,
  Thorncat, Boggle, Chitter) are all variations on *stopping* — souls that put
  down roots where they fell and let the green take the rest.
- **Warden (boss):** **Liora Fen**, a woman half-grown into a mossed trunk, roots
  where her legs were. She stopped walking here, let the green hold her — and
  then let it hold everyone who came after, so she would never sit alone. The
  echo she fights as is **Verdanox** (species id unchanged; she is the person
  inside it, as Sena is inside Glaciark). Her release is *"undo my knots — let
  them all go, me last."*
- **Relationship hosted:** a fifth face of grief — the one who keeps others for
  her own company, and calls it kindness. Her aftermath is a built side-beat
  (§11a).

## 6. The Last Light — the thesis in one encounter

A tiny, rare soul: a trembling candle-flame in a cracked black lantern, ash for
legs. When met, it tries to leave rather than fight. **10 HP, near-total evasion,
takes only 1 damage from ordinary attacks** — you cannot win by force. Each turn
its flame dims; after three turns it goes, peacefully. It is **not recruitable.**

Against it, the normal actions are replaced by **Grief**:

- **Remember** — "Remember who you are." 33% it lets you help it; rises to a
  cap of 66% on consecutive use. (Recall gives it back enough self to be reached.)
- **Comfort** — 10% each; the player speaks one of twenty condolences ("I'm sorry
  for what you've lost."). Comfort rarely *works*, but it is the precondition for—
- **Let Go** — "You are free." **100%** — but only *after* it has been comforted.
  Used too soon, the Light leaves with nothing given, and you have failed it.

Helping it move on grants a huge reward: **20× the usual EXP for its level**, and
a piece of **Immortality** — a rare resource whose pieces are the lines of a
public-domain elegy ("Do not stand at my grave and weep," Mary Elizabeth Frye;
used as verified public-domain text per §12). The pieces are given **in order and
once each**; collecting all of them unlocks a Memento (see §7): **a full life
remembered** grants 100% criticals for three turns. The mechanic *is* the
argument: you are rewarded not for holding the soul, but for understanding it
well enough to release it.

## 7. Reinterpreted systems (verbs → theme, §9)

- **Soul Syphon → Keeping.** Drawing a lingering soul into your lantern. Saves it
  from fading; refuses it rest. Every capture is the dramatic question in one act.
- **Soularium → the Book of Names.** A memorial against the Second Death. Logging
  a soul keeps its name said. Wren's verb, Remember, made mechanical.
- **Equipment (planned, §37 in the task list) → intimacy, not loot** (§15.5):
  **Arms** (what a soul carried), **Shrouds** (what covered them), **Mementos**
  (what was kept of them). A Memento is a legacy item — the Immortality set is
  the first.
- **Run (already shipped) → turning away.** You may leave an echo unmet. Some
  souls are not yours to keep or free.

## 8. Public-domain sources drawn on (§12–13)

Ideas only, no protected expression; a proper rights ledger (§22) should be
filled before commercial use.

- **Mary Elizabeth Frye, "Do not stand at my grave and weep"** — the Immortality
  poem pieces (widely treated as public domain; verify edition).
- **The Second Death / Book of Names** — *Spoon River Anthology* (§13.14): a place
  narrated by its dead; contradictory memory.
- **The Reliquary** — *The Picture of Dorian Gray* (§13.10) + vanitas (§15.4):
  corruption/preservation hidden in an object; kept light.
- **The Unremembered** — the myth of Lethe; *Everyman* (§13.6): companions tested
  at the threshold; what can and cannot cross.
- **The Last Light / Grief** — *Orpheus and Eurydice* (§14.1) and *The Death of
  Ivan Ilyich* (§13.12): release requires understanding, not force.
- **Halden the Custodian** — Marcus Aurelius (§13.4) and hospice/psychopomp
  traditions: acceptance as difficult labor.

## 9. What changed in this pass (implementation)

- **Intro/prologue** rewritten to establish the wake, the lantern, the
  Unfinished, and death-at-a-distance.
- **The Everwake** first-arrival recast around the wake and Halden the Custodian.
- **Reach names & blurbs:** Crystal Cavern → **The Reliquary**; Haunted Dungeon →
  **The Unremembered**; The Quiet Crossing kept, reframed.
- **Boss reframes:** Regalion → **the Vigil**; Glaciark → **Sena Vale**;
  Revenance → **the Unnamed**. (Species ids unchanged; names/dialogue only.)
- **Radio & boss dialogue** rewritten to carry the theme and introduce Halden,
  Sena, and Wren.
- Smoke tests updated for the renamed reaches.

## 10. Built since (now in the game)

- **The Last Light** full Grief encounter (§6) — Remember / Comfort / Let Go,
  the three-turn dim, the 20× EXP boon, and the Immortality poem pieces awarded
  in order (`data/immortality.ts`, `BattleScene.runLastLight`).
- **Equipment** as intimacy items — Arms / Shrouds / Mementos, one slot each
  (`data/equipment.ts`, `ui/GearScreen.ts`); the **Immortality Memento**
  (100% criticals for a battle's first three rounds) unlocks when all twelve
  poem pieces are collected.

## 11. The midpoint — the unanswerable death (built)

After all three reaches are quiet, returning to the Everwake fires the midpoint
(framework §11.4). **Halden** is dying — the ordinary way, a whole life the
Keeping cannot hold. The player instinctively raises the lantern; it fails,
because *you cannot syphon a person, only the echo one leaves*. His last lesson
is the thesis: keeping was never the same as loving, and the things that matter
most you honour by letting go.

Then the player **authors the farewell** (framework §10.5) — keep his **name**
(against the second death), take up his **work** (inherit the duty, and
*Halden's Serial*, a Memento), or **let him go** (keep nothing). No option is
correct; each is a real loss.

And **every philosophy hardens** (framework §11.3), delivered as the survivors'
response: **Sena** turns coercive ("bring me a soul you love and I will freeze
it, so you never lose another"), **Wren** turns captive ("if every name is
written down, no one is truly gone — tell me they are not gone"), and the
player — the Unfinished — must face that all their Keeping may have been a
refusal, over and over, to let a single soul go. Flags: `midpointDone`,
`haldenGone`, `mourn:*`, `actTwo`.

## 11a. The Overgrowth's aftermath — a side-beat (built)

Clearing The Overgrowth (§5a) pays off back home, independent of the main-line
midpoint. Liora Fen — unrooted now, learning legs that were roots for years —
follows the light to the Everwake to cross, having stayed to watch every soul she
kept go first. She names what her keeping really was: *"I told them I was giving
them rest. I was keeping myself company."*

The player answers the smaller version of the game's question — **You were
lonely** (the gentler truth) or **You were cruel** (the harder truth). Both are
true (framework §17.3: every philosophy a victory and a casualty); the choice
only colours her farewell and sets `mourn:liora:kind` / `mourn:liora:true`. Either
way she leaves **Liora's Step** — a Memento (+5 SPD) of the walk she stopped
taking, "carried so its bearer never does." Fires once, gated on `jungleCleared`
→ `jungleWakeDone`; it does not touch or trigger the midpoint. Implemented in
`HubScene.jungleAftermath()`; covered by `tools/smoke/jungle.mjs`.

## 12. Still ahead (tracked, not yet built)

- Act-III: characters borrow from their opponents (§11.5) and a finale
  temptation (§11.6) that exposes what the player valued.
- Companion arcs for Sena and Wren beyond their single scenes.

> **Closing test (framework closing principle):** every change above was made
> against one question — *what does this reveal about living that could only be
> revealed through death?*
