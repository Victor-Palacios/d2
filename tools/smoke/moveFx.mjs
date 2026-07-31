import { chromium } from 'playwright';
const OUT = process.env.OUT ?? new URL('./shots', import.meta.url).pathname;
const browser = await chromium.launch({
  executablePath: process.env.CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));
await page.goto((process.env.URL ?? 'http://localhost:5199/'), { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
// Cheap render so the software rasteriser can draw at all (see tools/smoke/README.md).
await page.evaluate(() => {
  const g = window.hd2dGame; const p = g.hd2d.params;
  p.supersample = 0.5; p.dofEnabled = false; p.tiltEnabled = false;
  g.hd2d.renderer.shadowMap.enabled = false; g.hd2d.applyParams();
});
await page.waitForTimeout(1000);

// A first-dungeon fight gives us a real caster and real targets to drive moves at.
await page.evaluate(async () => {
  const g = window.hd2dGame;
  g.game.party = [];
  ['emberling', 'glidefang', 'nightnip'].forEach((id) => g.game.captureSpecies(id, 6));
  await g.manager.go('battle', {
    enemies: [{ species: 'regalion', level: 4 }, { species: 'gloomote', level: 3 }, { species: 'dropletta', level: 3 }],
    isBoss: true,
    returnTo: 'dungeon',
  });
});
await page.waitForTimeout(800);

// Drive one move of every delivery archetype through the real turn animation and
// measure the particle spike each leaves. This exercises the whole per-move path
// — cast telegraph, projectile flight (bolt), and the shaped impact burst — end
// to end, including the moveFx() derivation, on the live scene.
const report = await page.evaluate(async () => {
  const g = window.hd2dGame;
  const scene = g.manager.activeScene;
  const particles = scene.particles;
  const countAlive = () => {
    const pos = particles.points.geometry.getAttribute('position').array;
    let n = 0;
    for (let i = 1; i < pos.length; i += 3) if (pos[i] > -9000) n++;
    return n;
  };
  const flush = () => { for (let f = 0; f < 150; f++) scene.update(1 / 60, 30 + f / 60); };

  const attacker = scene.battle.side('party')[0];
  const target = scene.battle.side('enemy')[1]; // an echo, not the boss

  const runMove = async (techniqueId, actionLabel, heal) => {
    flush(); // let any lingering motes die so the count reflects just this move
    await scene.animateTurn(attacker, {
      actorUid: attacker.creature.uid,
      actionLabel,
      techniqueId,
      hits: [{ targetUid: heal ? attacker.creature.uid : target.creature.uid, damage: heal ? 0 : 14, heal: heal ? 12 : 0, fainted: false }],
      log: [],
    });
    return countAlive();
  };

  const melee = await runMove('emberFang', 'Ember Fang', false); // fire, melee slash
  const bolt = await runMove('gloomLance', 'Gloom Lance', false); // dark, flying bolt
  const nova = await runMove('cinderBurst', 'Cinder Burst', false); // fire, area nova
  const mend = await runMove('mistVeil', 'Mist Veil', true); // water, mending bloom

  return { melee, bolt, nova, mend };
});

await page.screenshot({ path: `${OUT}/96-movefx.png` });

console.log('report:', JSON.stringify(report));
// Every archetype must actually emit; the bolt (trail + burst) must out-spark
// the plain heal, proving the shaping differs per move rather than being one
// flat effect.
const pass =
  report.melee >= 10 &&
  report.bolt >= 10 &&
  report.nova >= 10 &&
  report.mend >= 8 &&
  report.bolt > report.mend;
console.log('VERDICT:', pass ? 'PASS' : 'FAIL');
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
process.exit(pass && !errs.length ? 0 : 1);
