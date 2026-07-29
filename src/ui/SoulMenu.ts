import { GridMenu } from './GridMenu';
import type { GridItem } from './GridMenu';
import { menuIcon } from './icons';
import { openSoularium } from './SoulariumScreen';
import { openSanctuary } from './SanctuaryScreen';
import { openPartyArrange } from './PartyScreen';
import { openGear } from './GearScreen';
import { openTranscend } from './TranscendScreen';

/**
 * The main system menu (R1 / E / Start), in the style of a modern handheld RPG:
 * a grid of icon + name cards. Open in town and while crawling. Routes to the
 * party arranger, the Soularium (book of names / dex) and the Soul Sanctuary
 * (reserve management).
 */
export async function openSoulMenu(parent: HTMLElement): Promise<void> {
  for (;;) {
    const items: GridItem[] = [
      {
        value: 'party',
        label: 'Party',
        sublabel: 'arrange the fielded three',
        icon: menuIcon('party', '#8fd0ff'),
        color: '#8fd0ff',
      },
      {
        value: 'gear',
        label: 'Gear',
        sublabel: 'arms · shrouds · mementos',
        icon: menuIcon('arrange', '#7bdc8a'),
        color: '#7bdc8a',
      },
      {
        value: 'soularium',
        label: 'Soularium',
        sublabel: 'the book of names',
        icon: menuIcon('soularium', '#ffd166'),
        color: '#ffd166',
      },
      {
        value: 'sanctuary',
        label: 'Sanctuary',
        sublabel: 'bench or call up souls',
        icon: menuIcon('sanctuary', '#c77dff'),
        color: '#c77dff',
      },
      {
        value: 'transcend',
        label: 'Transcend',
        sublabel: 'evolve · de-evolve',
        icon: menuIcon('transcend', '#ff9de2'),
        color: '#ff9de2',
      },
    ];
    const menu = new GridMenu(parent, items, { heading: 'MENU', subheading: 'The Everwake' });
    const choice = await menu.open();
    menu.destroy();
    if (!choice) return;

    if (choice === 'party') await openPartyArrange(parent);
    else if (choice === 'gear') await openGear(parent);
    else if (choice === 'soularium') await openSoularium(parent);
    else if (choice === 'sanctuary') await openSanctuary(parent);
    else if (choice === 'transcend') await openTranscend(parent);
    // Loop back to the menu after a sub-screen closes, so it feels like a hub.
  }
}
