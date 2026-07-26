import { clear, el, esc, remove } from './dom';
import { Menu } from './Menu';
import type { MenuItem } from './Menu';
import { SPECIES, speciesArt } from '../data/creatures';
import { ATTRIBUTES, ELEMENTS } from '../data/elements';
import { game } from '../systems/party/gameState';
import { pixelArtElement } from '../engine/pixel';

/**
 * The Soularium — the capture dex. Opened with R1 (or the E key) in town and
 * while crawling. Read-only: browse encountered species, see how far each Soul
 * Syphon has filled, and which are logged (★). Locked species stay hidden until
 * you first meet them, so the list doubles as a "what's left to find" tracker.
 */
export async function openSoularium(parent: HTMLElement): Promise<void> {
  const ids = Object.keys(SPECIES);
  const logged = ids.filter((id) => game.soul(id).captured).length;

  const root = el('div', 'screen');
  root.id = 'soularium';
  root.appendChild(el('h1', 'title-main', 'SOULARIUM'));
  root.appendChild(el('p', 'title-sub', `${logged} / ${ids.length} souls logged`));

  const wrap = el('div', 'shop-wrap');
  const listPanel = el('div', 'panel');
  listPanel.appendChild(el('h2', undefined, 'Souls'));
  const menuHost = el('div');
  listPanel.appendChild(menuHost);

  const info = el('div', 'panel');
  info.appendChild(el('h2', undefined, 'Detail'));
  const desc = el('div', 'desc');
  info.appendChild(desc);

  wrap.append(listPanel, info);
  root.appendChild(wrap);
  root.appendChild(el('div', 'hint', 'UP/DOWN browse · X / B close'));
  parent.appendChild(root);

  const items = (): MenuItem[] =>
    ids.map((id) => {
      const e = game.soul(id);
      const s = SPECIES[id];
      return {
        value: id,
        label: e.seen ? s.name : '??? ',
        note: e.captured ? '★' : e.seen ? `${Math.round(e.syphon)}%` : '—',
        color: e.captured ? '#ffd166' : undefined,
      };
    });

  const showDesc = (id: string) => {
    clear(desc);
    const e = game.soul(id);
    const s = SPECIES[id];
    if (!e.seen) {
      desc.innerHTML =
        '<strong>??? </strong><br><span class="dim">Not yet encountered. Syphon a soul in battle to log it here.</span>';
      return;
    }
    const holder = el('div');
    holder.style.cssText = 'display:flex;justify-content:center;padding:4px 0;';
    holder.appendChild(pixelArtElement(speciesArt(id), 4));
    desc.appendChild(holder);
    const attr = ATTRIBUTES[s.attribute];
    const elem = ELEMENTS[s.element];
    const status = e.captured
      ? '<span class="accent">★ Logged — buy it at the Soul Store</span>'
      : `<span class="dim">Soul Syphon</span> <b>${Math.round(e.syphon)}%</b>`;
    desc.appendChild(
      el(
        'div',
        undefined,
        `<strong>${esc(s.name)}</strong> <span class="dim">${attr.name} · ${elem.name}</span>` +
          `<br>${status}<br><br><span class="dim">${esc(s.blurb)}</span>`,
      ),
    );
  };

  // Loop so only Cancel (X / R1 both map to it here) leaves; selecting a row
  // just keeps browsing.
  for (;;) {
    const menu = new Menu(menuHost, items(), { cancellable: true, onHighlight: (v) => showDesc(v) });
    const choice = await menu.open();
    menu.destroy();
    if (!choice) break;
  }

  remove(root);
}
