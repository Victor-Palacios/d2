import { el, remove } from './dom';
import { Menu } from './Menu';
import { openSoularium } from './SoulariumScreen';
import { openSanctuary } from './SanctuaryScreen';

/**
 * The R1 / E menu: a small chooser that opens the Soularium (capture dex) or the
 * Soul Sanctuary (party/reserve management). Available in town and while
 * crawling.
 */
export async function openSoulMenu(parent: HTMLElement): Promise<void> {
  const host = el('div', 'panel');
  host.id = 'soul-menu';
  host.style.cssText =
    'position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);min-width:240px;';
  host.appendChild(el('h2', undefined, 'Soul Menu'));
  parent.appendChild(host);

  const menu = new Menu(
    host,
    [
      { value: 'soularium', label: 'Soularium', note: 'dex' },
      { value: 'sanctuary', label: 'Soul Sanctuary', note: 'party' },
    ],
    { cancellable: true },
  );
  const choice = await menu.open();
  menu.destroy();
  remove(host);

  if (choice === 'soularium') await openSoularium(parent);
  else if (choice === 'sanctuary') await openSanctuary(parent);
}
