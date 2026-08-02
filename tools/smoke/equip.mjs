import { load, launch, openPage, startInHub } from './_harness.mjs';

// Equipment: the keeper's kit is granted at the start, and the Gear screen fits
// an item into a soul's slot (moving it out of the bag). Verifies via the live
// game state after driving the real menu → Gear → member → slot → item flow.
// See tools/smoke/README.md.

const browser = await launch();
const { page, errs } = await openPage(browser, { viewport: { width: 900, height: 560 } });

const bag = () => page.evaluate(() => ({ ...window.hd2dGame.game.bag }));
const equip0 = () => page.evaluate(() => ({ ...(window.hd2dGame.game.party[0].equip ?? {}) }));
const clickMenu = async (label) => {
  const loc = page.locator('.menu li', { hasText: label }).first();
  if (await loc.count()) {
    await loc.click();
    await page.waitForTimeout(300);
    return true;
  }
  return false;
};

await load(page);
await startInHub(page);

const kit = await bag();
console.log('keeper kit in bag  :', JSON.stringify(kit));
const hasKit = kit.cinderEdge > 0 && kit.paleShroud > 0 && kit.quickLocket > 0;

// Open menu (E), move to Gear (right of Party), open it.
await page.keyboard.press('e');
await page.waitForTimeout(400);
await page.locator('.grid-card', { hasText: 'Gear' }).click();
await page.waitForTimeout(500);
// Member list → pick the first soul.
await clickMenu('Emberling');
// Slot list → Arms.
await clickMenu('Arms');
// Item list → Cinder Edge.
const equipped = await clickMenu('Cinder Edge');
await page.waitForTimeout(300);

const eq = await equip0();
const bagAfter = await bag();
console.log('party[0].equip     :', JSON.stringify(eq));
console.log('bag after equip    :', JSON.stringify(bagAfter));
const armsSet = eq.arms === 'cinderEdge';
const bagSpent = !(bagAfter.cinderEdge > 0);

console.log('kit granted        :', hasKit);
console.log('equip flow ran     :', equipped);
console.log('arms slot fitted   :', armsSet);
console.log('item left the bag  :', bagSpent);

const ok = hasKit && armsSet && bagSpent;
console.log('\nEQUIP OK :', ok);
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
