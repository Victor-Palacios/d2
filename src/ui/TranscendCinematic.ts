import { el, esc, remove } from './dom';
import { pixelArtElement } from '../engine/pixel';
import { speciesArt, species } from '../data/creatures';
import { ELEMENTS } from '../data/elements';
import { audio } from '../engine/Audio';
import { input } from '../engine/Input';

/**
 * The transcendence cinematic — the fanfare a soul earns when it changes shape.
 *
 * A deliberate homage to the Pokémon Red/Blue evolution sequence (the sprite
 * strobing between its old and new silhouettes, faster and faster, then a white
 * bloom and the reveal) — re-scored for this game's mood: not a bright jingle
 * and a party popper, but a soul-light rite. Ethereal sines, a slow gather, an
 * element-tinted aura, and a caption that *keeps* rather than *celebrates*.
 * De-evolution runs the same beats in reverse — a settling-home rather than an
 * ascent.
 *
 * It is purely cosmetic: the creature's data has already been transformed by
 * `evolve()`/`devolve()` before this plays, so nothing here can fail the change
 * or be left half-applied. Skippable at any time with **Start** (the on-screen
 * note says so), which resolves the promise immediately.
 */

export interface TranscendCinematicOpts {
  fromId: string;
  toId: string;
  mode: 'evolve' | 'devolve';
  /** The soul's display name (its nickname, or its pre-change species name). */
  displayName: string;
  /** Move ids the new form learned that the old one did not. */
  gainedMoves: string[];
}

// Phase boundaries, in seconds. Kept small enough to feel like fanfare, not a
// cutscene; the whole rite is ~4.2s and every beat of it is skippable.
const GATHER = 0.55; // fade in, the aura wakes, the old form stands
const FLASH = 2.35; // the strobing morph between the two silhouettes
const BLOOM = 0.5; // the white burst that hides the swap to full colour
const SETTLE = 4.2; // the caption holds, then it lets you go

/** Beat times for the strobe: an accelerating gap, so it reads as building. */
function strobeBeats(dur: number): number[] {
  const beats: number[] = [];
  let t = 0;
  let gap = 0.26;
  while (t < dur) {
    beats.push(t);
    gap = Math.max(0.07, gap * 0.86);
    t += gap;
  }
  return beats;
}

export function playTranscend(parent: HTMLElement, opts: TranscendCinematicOpts): Promise<void> {
  const { fromId, toId, mode } = opts;
  const evolving = mode === 'evolve';
  const tint = ELEMENTS[species(toId).element].color;
  const toName = species(toId).name;

  const root = el('div', 'transcend-cine');
  root.style.setProperty('--tint', tint);

  const stage = el('div', 'tc-stage');
  const aura = el('div', 'tc-aura');
  const burst = el('div', 'tc-burst');
  const flash = el('div', 'tc-flash');

  // Both forms, stacked. `.sil` renders a form as a solid white silhouette
  // (`brightness(0) invert(1)` keeps the shape, drops the colour) — the strobe
  // cross-fades between the two silhouettes; the reveal drops `.sil` off the
  // new form to show it in full colour.
  const oldSprite = pixelArtElement(speciesArt(fromId), 7);
  oldSprite.className = 'tc-sprite sil';
  const newSprite = pixelArtElement(speciesArt(toId), 7);
  newSprite.className = 'tc-sprite sil';
  newSprite.style.opacity = '0';

  stage.append(aura, oldSprite, newSprite, burst, flash);

  const caption = el('div', 'tc-caption');
  caption.style.opacity = '0';

  const skip = el('div', 'tc-skip', 'Press <b>START</b> <span class="tc-key">(E)</span> to skip');

  root.append(stage, caption, skip);
  parent.appendChild(root);

  return new Promise<void>((resolve) => {
    let done = false;
    let raf = 0;
    let unsub: (() => void) | null = null;
    const start = performance.now();
    const beats = strobeBeats(FLASH);
    let bloomed = false;
    let captioned = false;
    let audioFired = false;

    const finish = () => {
      if (done) return;
      done = true;
      if (raf) cancelAnimationFrame(raf);
      unsub?.();
      remove(root);
      resolve();
    };

    // Jump straight to the resolved state: new form, in colour, caption shown —
    // so a skip still *shows what it became*, it just doesn't dwell. A second
    // Start (or confirm/cancel) then dismisses.
    const skipToReveal = () => {
      if (bloomed) {
        // Already revealed — a press here means "let me go".
        finish();
        return;
      }
      bloomed = true;
      captioned = true;
      if (raf) cancelAnimationFrame(raf);
      oldSprite.style.opacity = '0';
      newSprite.classList.remove('sil');
      newSprite.style.opacity = '1';
      newSprite.style.transform = 'scale(1)';
      flash.style.opacity = '0';
      aura.style.opacity = '1';
      showCaption();
      skip.innerHTML = 'Press <b>START</b> <span class="tc-key">(E)</span> to continue';
    };

    const showCaption = () => {
      const verb = evolving ? 'evolved into' : 'returned to';
      const moves =
        opts.gainedMoves.length && evolving
          ? `<div class="tc-moves">Awakens ${opts.gainedMoves.length === 1 ? 'a new art' : 'new arts'}</div>`
          : '';
      caption.innerHTML =
        `<span class="tc-line"><b>${esc(opts.displayName)}</b> ${verb} <b style="color:var(--tint)">${esc(toName)}</b>${evolving ? '!' : '.'}</span>${moves}`;
      caption.style.opacity = '1';
      if (audio.hasCry(toId)) audio.cry(toId);
      else audio.sfx(evolving ? 'victory' : 'heal');
    };

    // Start = skip (per the on-screen note). `menu` (keyboard **E**) is this
    // game's Start-button mirror — Hub/Dungeon open the Soul menu on either — so
    // it skips too, giving keyboard players a key. During the reveal/settle,
    // any of Start/confirm/cancel dismisses.
    unsub = input.onAction((a) => {
      if (a === 'start' || a === 'menu') skipToReveal();
      else if (bloomed && (a === 'confirm' || a === 'cancel')) finish();
    });

    const frame = (now: number) => {
      const t = (now - start) / 1000;

      if (t < GATHER) {
        // Gather: overlay + aura wake; the old form fades up from the dark.
        const k = t / GATHER;
        root.style.opacity = String(Math.min(1, k * 1.4));
        aura.style.opacity = String(k * 0.7);
        oldSprite.style.opacity = String(k);
      } else if (t < GATHER + FLASH) {
        // Strobe: swap silhouettes on each accelerating beat, pulsing scale and
        // the white veil so the whole stage throbs brighter as it speeds up.
        root.style.opacity = '1';
        if (!audioFired) {
          audioFired = true;
          audio.transcend(mode);
        }
        const ft = t - GATHER;
        let idx = 0;
        for (let i = 0; i < beats.length; i++) if (ft >= beats[i]) idx = i;
        const onNew = idx % 2 === 1;
        oldSprite.style.opacity = onNew ? '0' : '1';
        newSprite.style.opacity = onNew ? '1' : '0';
        // Progress 0..1 through the strobe drives a swell + brighter veil.
        const p = ft / FLASH;
        const beatT = ft - beats[idx];
        const nextGap = (beats[idx + 1] ?? beats[idx] + 0.07) - beats[idx];
        const pulse = 1 - Math.min(1, beatT / nextGap); // 1 at the beat, 0 before the next
        const scale = 1 + p * 0.14 + pulse * 0.06;
        oldSprite.style.transform = `scale(${scale})`;
        newSprite.style.transform = `scale(${scale})`;
        aura.style.opacity = String(0.6 + p * 0.4);
        flash.style.opacity = String((0.12 + p * 0.5) * pulse);
      } else if (t < GATHER + FLASH + BLOOM) {
        // Bloom: the veil floods to white, hiding the swap to the colour form.
        const k = (t - GATHER - FLASH) / BLOOM;
        if (!bloomed && k > 0.5) {
          bloomed = true;
          oldSprite.style.opacity = '0';
          newSprite.classList.remove('sil');
          newSprite.style.opacity = '1';
          burst.classList.add('go');
        }
        // Veil rushes to full white at the midpoint, then clears.
        flash.style.opacity = String(k < 0.5 ? 0.5 + k : Math.max(0, 2 - k * 2));
        const scale = 1.14 + Math.sin(Math.min(1, k) * Math.PI) * 0.14;
        newSprite.style.transform = `scale(${scale})`;
      } else {
        // Settle: colour form holds, aura steady, caption rises. Auto-releases
        // at SETTLE, or the player dismisses sooner.
        flash.style.opacity = '0';
        aura.style.opacity = '1';
        newSprite.style.opacity = '1';
        newSprite.style.transform = 'scale(1)';
        if (!captioned) {
          captioned = true;
          showCaption();
          skip.innerHTML = 'Press <b>START</b> <span class="tc-key">(E)</span> to continue';
        }
        if (t >= SETTLE) {
          finish();
          return;
        }
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
}
