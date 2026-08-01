// Shared smoke-test harness.
//
// Every script used to inline the same ~40 lines: launch Chromium, dismiss the
// title splash, strip the post-processing stack, then drive the whole opening UI
// (New Game -> name OK -> mash Enter through the prologue cutscene -> click the
// Emberling card -> drain the hub dialogue) before doing anything. On the GPU-less
// CI container that renders at ~1fps, so the opening drive times out — and the
// blocks had drifted (some never disabled shadows, the real cause of the slowness).
//
// This module centralises all of it. The key win is `startInHub`: a *headless
// entry point* that seeds the exact state a New Game produces (via the game's own
// `game.startNewGame`, the same call IntroScene makes) and jumps straight to the
// hub, skipping the title, cutscene, name entry and partner cards entirely. The
// two scripts whose subject IS the opening (`cutscene.mjs`, `opening.mjs`) use
// `playOpening`/`load` + the real cards instead.
//
// Usage:
//   import { launch, openPage, load, helpers, startInHub } from './_harness.mjs';
//   const browser = await launch();
//   const { page, errs } = await openPage(browser);
//   await load(page);
//   const h = helpers(page);
//   await startInHub(page);            // now in the hub, party = starter + Wren
//   ... test body using h.waitScene / h.press / h.idle ...
import { chromium } from 'playwright';

const DEFAULT_URL = process.env.URL ?? 'http://localhost:4173/';
const SWIFTSHADER = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'];

export function launch() {
  return chromium.launch({ executablePath: process.env.CHROME, args: SWIFTSHADER });
}

/** A page with error capture. Returns { page, errs } — errs collects pageerror + console.error. */
export async function openPage(browser, { viewport = { width: 720, height: 405 }, context = false } = {}) {
  const host = context ? await browser.newContext({ viewport }) : browser;
  const page = context ? await host.newPage() : await browser.newPage({ viewport });
  const errs = [];
  page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('404')) errs.push('[console] ' + m.text());
  });
  return { page, errs };
}

/** The canonical full FX-strip — post stack off AND shadows off — to hit ~26fps on SwiftShader. */
export async function stripFX(page) {
  await page.evaluate(() => {
    const g = window.hd2dGame;
    const p = g.hd2d.params;
    p.supersample = 0.35;
    p.dofEnabled = false;
    p.tiltEnabled = false;
    p.bloomEnabled = false;
    g.hd2d.renderer.shadowMap.enabled = false;
    g.hd2d.applyParams();
  });
}

/** Load the page, dismiss the "press any button" splash, strip FX, wait until the game is live. */
export async function load(page, { url = DEFAULT_URL } = {}) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('.title-press', { timeout: 6000 }).catch(() => {});
  if (await page.locator('.title-press').count()) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
  }
  await page.waitForFunction(() => !!window.hd2dGame, { timeout: 10000 });
  await stripFX(page);
  await page.waitForTimeout(300);
}

/** The shared readiness/navigation helpers, bound to a page. */
export function helpers(page) {
  const scene = () => page.evaluate(() => window.hd2dGame.manager.current);
  const dlg = () =>
    page.evaluate(() => {
      const d = document.querySelector('#dialogue');
      return !!d && d.style.display !== 'none';
    });
  const busy = () => page.evaluate(() => window.hd2dGame.manager.activeScene?.busy ?? false);
  const press = async (key, n = 1, gap = 300) => {
    for (let i = 0; i < n; i++) {
      await page.keyboard.press(key);
      await page.waitForTimeout(gap);
    }
  };
  const clearDlg = async (max = 80) => {
    for (let i = 0; i < max; i++) {
      if (!(await dlg())) return;
      await page.keyboard.press('Enter');
      await page.waitForTimeout(150);
    }
  };
  // Returns once the scene is genuinely settled (not busy, no open dialogue),
  // advancing dialogue while it waits.
  const idle = async (n = 80) => {
    for (let i = 0; i < n; i++) {
      if (!(await busy()) && !(await dlg())) return;
      if (await dlg()) {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
      } else {
        await page.waitForTimeout(250);
      }
    }
  };
  // Wait for a scene, guarding the arrival() race: a scene's arrival opens with
  // `await sleep(280)`, so it matches while momentarily idle before its dialogue
  // appears. Give it a beat after first match, then require a true idle.
  const waitScene = async (name, ms = 45000) => {
    const t0 = Date.now();
    let settled = false;
    while (Date.now() - t0 < ms) {
      const cur = await scene();
      if (cur === name && !settled) {
        settled = true;
        await page.waitForTimeout(500);
        continue;
      }
      if (cur === name && !(await dlg()) && !(await busy())) return true;
      if (await dlg()) {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
      } else {
        await page.waitForTimeout(220);
      }
    }
    console.log('  !! timeout waiting for', name, '— at', await scene());
    return false;
  };
  const pickPartner = async (name = 'Emberling', max = 50) => {
    for (let i = 0; i < max; i++) {
      if (await page.locator('.card', { hasText: name }).count()) {
        await page.locator('.card', { hasText: name }).click();
        await page.waitForTimeout(300);
        return true;
      }
      await page.keyboard.press('Enter'); // presses through the prologue cutscene + narration
      await page.waitForTimeout(200);
    }
    return false;
  };
  return { scene, dlg, busy, press, clearDlg, idle, waitScene, pickPartner };
}

/**
 * Headless entry point: seed the exact state a New Game produces and land in the
 * hub, skipping the title / cutscene / name entry / partner cards. Reproduces the
 * real opening's result — including Wren joining at first arrival — by going to
 * the hub with `arrival: 'first'` and draining the arrival dialogue, so tests that
 * expect the started party (starter + Wren) and the first autosave still hold.
 * Pass `{ arrival: null }` for a bare quiet hub (starter only, no arrival beats).
 */
export async function startInHub(page, { partner = 'emberling', arrival = 'first' } = {}) {
  await page.evaluate(
    async ({ partner, arrival }) => {
      const g = window.hd2dGame;
      g.game.startNewGame(partner);
      await g.manager.go('hub', arrival ? { arrival } : undefined);
    },
    { partner, arrival },
  );
  const h = helpers(page);
  await h.waitScene('hub');
}

/**
 * Drive the *real* opening UI to the hub, reliably: New Game -> name OK -> through
 * the prologue cutscene -> pick the partner card -> hub. For scripts that want to
 * exercise the genuine opening path rather than the headless shortcut.
 */
export async function playOpening(page, { partner = 'Emberling' } = {}) {
  const h = helpers(page);
  await page.keyboard.press('Enter'); // title menu -> New Game
  await page.waitForTimeout(700);
  await page
    .locator('.keyboard button', { hasText: /^OK$/ })
    .click()
    .catch(() => {});
  await page.waitForTimeout(500);
  await h.pickPartner(partner);
  await h.waitScene('hub');
}
