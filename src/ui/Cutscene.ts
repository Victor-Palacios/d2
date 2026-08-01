import { sleep } from '../engine/SceneManager';
import { input } from '../engine/Input';
import { el, esc, remove } from './dom';
import type { Cutscene } from '../data/cutscenes';

/**
 * Plays a {@link Cutscene} as a letterboxed overlay over whatever HD-2D diorama
 * is already mounted (the Option-A design): a colour wash grades the mood, one
 * or two lines of centred prose fade through per beat, and the host scene's own
 * camera drift supplies the motion. Non-interactive but always skippable — any
 * button (or a click) ends it at once — so it can sit in the New Game flow
 * without ever blocking a player or a smoke test.
 *
 * Resolves when the cutscene finishes or is skipped. `shouldAbort` lets a caller
 * bail if its scene is torn down mid-play (see the `disposed` invariant).
 */
export async function playCutscene(
  ui: HTMLElement,
  cs: Cutscene,
  opts: { shouldAbort?: () => boolean } = {},
): Promise<void> {
  const abort = opts.shouldAbort ?? (() => false);
  if (!cs.beats.length) return;

  const root = el('div', 'cutscene');
  root.style.cssText =
    'position:absolute;inset:0;z-index:50;opacity:0;transition:opacity .6s ease;pointer-events:auto;overflow:hidden;';

  // The mood wash — a flat colour over the diorama, crossfaded per beat.
  const tint = el('div');
  tint.style.cssText =
    'position:absolute;inset:0;background:transparent;opacity:.55;transition:background 1.2s ease;mix-blend-mode:multiply;';

  // Letterbox bars grow in for the cinematic frame.
  const barCss = 'position:absolute;left:0;right:0;height:0;background:#000;transition:height .6s ease;';
  const barTop = el('div');
  barTop.style.cssText = `${barCss}top:0;`;
  const barBottom = el('div');
  barBottom.style.cssText = `${barCss}bottom:0;`;

  const caption = el('div', 'cutscene-cap');
  caption.style.cssText =
    'position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);max-width:80%;text-align:center;' +
    'opacity:0;transition:opacity .45s ease;color:#f3ede0;font-size:1.35rem;line-height:1.7;letter-spacing:.02em;' +
    'text-shadow:0 2px 12px rgba(0,0,0,.9);';

  root.append(tint, barTop, barBottom, caption);
  if (cs.skipHint) {
    const hint = el('div', undefined, esc(cs.skipHint));
    hint.style.cssText =
      'position:absolute;left:50%;bottom:8%;transform:translateX(-50%);color:rgba(243,237,224,.5);' +
      'font-size:.8rem;letter-spacing:.14em;text-transform:uppercase;';
    root.appendChild(hint);
  }
  ui.appendChild(root);

  // Skip plumbing: any confirm/cancel/start action (or a click) ends the whole
  // cutscene. `interrupt` also cuts a beat's hold short so the skip is instant.
  let skipped = false;
  let interrupt: (() => void) | null = null;
  const skip = () => {
    skipped = true;
    interrupt?.();
  };
  const unsub = input.onAction((a) => {
    if (a === 'confirm' || a === 'cancel' || a === 'start') skip();
  });
  root.addEventListener('click', skip);

  // A wait that a skip (or an abort) can cut short.
  const wait = (ms: number) =>
    Promise.race([sleep(ms), new Promise<void>((res) => (interrupt = res))]).then(() => {
      interrupt = null;
    });

  // Raise the frame.
  await sleep(20);
  root.style.opacity = '1';
  barTop.style.height = '12vh';
  barBottom.style.height = '12vh';
  await wait(520);

  for (const beat of cs.beats) {
    if (skipped || abort()) break;
    if (beat.tint) tint.style.background = beat.tint;
    caption.innerHTML = beat.lines.map(esc).join('<br>');
    caption.style.opacity = '1';
    await wait(beat.hold ?? 2600);
    if (skipped || abort()) break;
    caption.style.opacity = '0';
    await wait(440);
  }

  // Tear the frame down.
  caption.style.opacity = '0';
  root.style.opacity = '0';
  await sleep(skipped ? 120 : 620);
  unsub();
  remove(root);
}
