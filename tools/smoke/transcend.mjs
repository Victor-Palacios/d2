// Transcendence + learnset smoke test. Drives the headless evolve/creature APIs
// exposed on window.hd2dGame to prove: level-gated learnsets, level-10 branching
// evolution, the physical/magical stat split, and reversible de-evolution.
import { chromium } from 'playwright';

const URL = process.env.URL ?? 'http://localhost:5199/';
const browser = await chromium.launch({
  executablePath: process.env.CHROME, // omit to use Playwright's own
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(URL, { waitUntil: 'domcontentloaded' });
// Lost Souls title: wait for and dismiss the "press any button" splash so the menu is reachable.
await page.waitForSelector('.title-press', { timeout: 4000 }).catch(() => {});
if (await page.locator('.title-press').count()) { await page.keyboard.press('Enter'); await page.waitForTimeout(300); }
await page.waitForFunction(() => !!(window.hd2dGame && window.hd2dGame.creature && window.hd2dGame.evolve));

const r = await page.evaluate(() => {
  const { creature, evolve } = window.hd2dGame;
  const { makeCreature } = creature;
  const out = {};

  // --- Learnset: moves accrue with level -------------------------------
  const lo = makeCreature('emberling', 1);
  const hi = makeCreature('emberling', 15);
  out.lowMoves = lo.techniques.slice();
  out.highMoves = hi.techniques.slice();
  out.learnsetGrows = hi.techniques.length > lo.techniques.length &&
    lo.techniques.includes('emberFang') && hi.techniques.includes('pyreLance');

  // --- Magick split: a mage out-damages a bruiser with a spell, and the
  //     reverse holds for a physical hit (mag vs res, off vs def) ---------
  const mage = makeCreature('gloomote', 10);   // high MAG, low OFF
  const bruiser = makeCreature('bulwarq', 10); // high OFF/DEF, low MAG
  out.mageMagBeatsOff = mage.mag > mage.off;
  out.bruiserOffBeatsMag = bruiser.off > bruiser.mag;
  out.statsPresent = [mage, bruiser].every((c) => typeof c.mag === 'number' && typeof c.res === 'number');

  // --- Evolution: not before the (debug) level, eligible at it ----------
  // Debug schedule: base→2nd at Lv2, →3rd at Lv3, →4th at Lv4.
  const young = makeCreature('emberling', 1);
  out.tooYoung = evolve.evolutionOptions(young).length === 0 && !evolve.canEvolve(young);

  const ready = makeCreature('emberling', 2);
  const opts = evolve.evolutionOptions(ready).map((o) => o.to);
  out.eligibleAtLevel = evolve.canEvolve(ready) && opts.includes('emberforge');

  // Digimon-style branching: two same-class paths (its own line + another
  // Hero line), and evolve() with no chosen target refuses the ambiguity.
  out.branches = opts.includes('emberforge') && opts.includes('grovelord') && opts.length >= 2;
  const ambiguous = makeCreature('emberling', 2);
  out.refusesAmbiguous = evolve.evolve(ambiguous) === null && ambiguous.speciesId === 'emberling';

  // Take a chosen branch: species/moves change, class/uid/level preserved.
  const uid = ready.uid; const lvl = ready.level;
  const res = evolve.evolve(ready, 'emberforge'); // pick a branch
  out.evolved = !!res && ready.speciesId === 'emberforge' &&
    ready.attribute === 'hero' && ready.uid === uid && ready.level === lvl &&
    ready.techniques.includes('emberFang');
  out.gained = res ? res.gainedMoves : [];

  // --- De-evolution keeps everything (known pool is monotonic) ----------
  const evolvedKnown = ready.techniques.slice();
  const canBack = evolve.canDevolve(ready) && evolve.devolveTargetId(ready) === 'emberling';
  const back = evolve.devolve(ready);
  const fresh = makeCreature('emberling', lvl);
  out.devolved = canBack && !!back && ready.speciesId === 'emberling' &&
    ready.attribute === 'hero' && ready.off === fresh.off && ready.mag === fresh.mag &&
    evolvedKnown.every((m) => ready.techniques.includes(m)); // nothing forgotten

  // --- Multi-stage line: emberling → emberforge → ashwarden → pyrelord ---
  const line = makeCreature('emberling', 4);
  const s1 = evolve.evolve(line, 'emberforge'); // → emberforge (Lv2, branch chosen)
  const s2 = evolve.evolve(line); // → ashwarden  (Lv3, single branch)
  const s3 = evolve.evolve(line); // → pyrelord   (Lv4, single branch)
  out.multiStage = !!s1 && !!s2 && !!s3 && line.speciesId === 'pyrelord' &&
    !evolve.canEvolve(line) && evolve.devolveTargetId(line) === 'ashwarden';

  // --- Cross-line de-evolution is exact (ancestry, not the static tree) ---
  // duskfang is shared by nightnip / prismoth / ashmoth; a prismoth that
  // crosses into it must return to prismoth, not the canonical nightnip.
  const crosser = makeCreature('prismoth', 2);
  evolve.evolve(crosser, 'duskfang');
  out.crossLineDevolve =
    crosser.speciesId === 'duskfang' &&
    evolve.devolveTargetId(crosser) === 'prismoth' &&
    !!evolve.devolve(crosser) &&
    crosser.speciesId === 'prismoth';

  // --- Class purity: no authored evolution crosses attribute ------------
  const cross = [];
  for (const [id, sp] of Object.entries(window.hd2dGame.roster.SPECIES)) {
    for (const opt of sp.evolutions ?? []) {
      if (!evolve.isSameClass(id, opt.to)) cross.push(`${id} → ${opt.to}`);
    }
  }
  out.classPure = cross.length === 0;
  out.crossClass = cross;

  // --- Loadout: known pool may exceed the fieldable cap -----------------
  const { activeMoves, MAX_ACTIVE_MOVES } = creature;
  const loaded = makeCreature('emberling', 20);
  out.loadoutCapped = loaded.loadout.length <= MAX_ACTIVE_MOVES &&
    activeMoves(loaded).length <= MAX_ACTIVE_MOVES &&
    loaded.loadout.every((m) => loaded.techniques.includes(m));

  // Terminal forms offer nothing.
  const geodon = makeCreature('geodon', 20);
  out.terminal = !evolve.canEvolve(geodon);

  // --- Damage channel: physical rides Off/Def, magical rides Mag/Res -----
  const { computeDamage, computeHeal } = window.hd2dGame.formula;
  const tech = window.hd2dGame.tech;
  const det = { rng: () => 0.5 };
  // Same attacker/defender, one physical hit vs one magical hit.
  const atk = makeCreature('emberling', 10);
  const def0 = makeCreature('cogling', 10);
  // Force clean stat gaps so the channel is unambiguous.
  atk.off = 30; atk.mag = 10; def0.def = 10; def0.res = 30;
  const phys = computeDamage({ attacker: atk, defender: def0, technique: tech('strike'), ...det }).amount;
  const magi = computeDamage({ attacker: atk, defender: def0, technique: tech('pyreLance'), ...det }).amount;
  // Physical (off30 vs def10) should out-hit magical (mag10 vs res30) despite
  // pyreLance's higher base power — proving the split reads the right stats.
  out.channelSplit = phys > magi;
  // A heal blends RES (0.7) and MAG (0.3): both stats raise it, and RES moves it
  // more than the same bump to MAG.
  const baseH = makeCreature('emberling', 10); baseH.res = 10; baseH.mag = 10;
  const moreMag = makeCreature('emberling', 10); moreMag.res = 10; moreMag.mag = 40;
  const moreRes = makeCreature('emberling', 10); moreRes.res = 40; moreRes.mag = 10;
  const h0 = computeHeal(baseH, tech('mistVeil'));
  const hM = computeHeal(moreMag, tech('mistVeil'));
  const hR = computeHeal(moreRes, tech('mistVeil'));
  out.healUsesBoth = hM > h0 && hR > h0 && hR > hM;

  // --- Roster sweep: every species builds at L1 and L20, every learnset move
  //     and every evolution target resolves, and no evolve/devolve throws -----
  const { SPECIES } = window.hd2dGame.roster;
  const problems = [];
  for (const id of Object.keys(SPECIES)) {
    try {
      makeCreature(id, 1);
      const c = makeCreature(id, 20);
      for (const t of c.techniques) tech(t); // throws on unknown technique id
      for (const opt of SPECIES[id].evolutions ?? []) {
        if (!SPECIES[opt.to]) problems.push(`${id} → unknown evo ${opt.to}`);
        const e = makeCreature(id, Math.max(opt.level, 1));
        const r2 = evolve.evolve(e, opt.to);
        if (!r2) problems.push(`${id} → ${opt.to} evolve returned null`);
        if (evolve.canDevolve(e) && !evolve.devolve(e)) problems.push(`${opt.to} devolve returned null`);
      }
    } catch (err) {
      problems.push(`${id}: ${err && err.message ? err.message : String(err)}`);
    }
  }
  out.rosterCount = Object.keys(SPECIES).length;
  out.rosterProblems = problems;
  out.rosterClean = problems.length === 0;

  return out;
});

const line = (label, ok) => console.log(`${ok ? 'ok ' : 'XX '} ${label}: ${ok}`);
console.log('== Transcendence ==');
console.log('L1 moves  :', JSON.stringify(r.lowMoves));
console.log('L15 moves :', JSON.stringify(r.highMoves));
console.log('gained on evolve:', JSON.stringify(r.gained));
line('learnset grows with level', r.learnsetGrows);
line('mage MAG > OFF', r.mageMagBeatsOff);
line('bruiser OFF > MAG', r.bruiserOffBeatsMag);
line('mag/res present on instances', r.statsPresent);
line('cannot evolve before level', r.tooYoung);
line('eligible at the debug gate (Lv2)', r.eligibleAtLevel);
line('offers two same-class branches', r.branches);
line('refuses an ambiguous evolve', r.refusesAmbiguous);
line('evolves along a chosen branch', r.evolved);
line('de-evolution keeps every move', r.devolved);
line('cross-line de-evolution is exact', r.crossLineDevolve);
line('multi-stage line resolves (→pyrelord)', r.multiStage);
line('terminal form has no path', r.terminal);
line('all evolutions are class-pure', r.classPure);
line('loadout capped at MAX_ACTIVE_MOVES', r.loadoutCapped);
line('damage channel splits phys/magic', r.channelSplit);
line('heal blends RES(0.7)+MAG(0.3)', r.healUsesBoth);
console.log(`roster sweep: ${r.rosterCount} species` + (r.rosterProblems.length ? '\n  ' + r.rosterProblems.join('\n  ') : ''));
line('every species + evolution resolves', r.rosterClean);

const ok = r.learnsetGrows && r.mageMagBeatsOff && r.bruiserOffBeatsMag && r.statsPresent &&
  r.tooYoung && r.eligibleAtLevel && r.branches && r.refusesAmbiguous && r.evolved && r.devolved &&
  r.crossLineDevolve && r.multiStage && r.terminal && r.classPure && r.loadoutCapped &&
  r.channelSplit && r.healUsesBoth && r.rosterClean;

console.log('\nERRORS:', errs.length ? errs.join('\n') : '(none)');
console.log(ok && !errs.length ? '\nPASS' : '\nFAIL');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
