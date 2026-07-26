import { el, remove } from './dom';

/** Transient banner for pickups, EP warnings, floor changes. */
export function toast(parent: HTMLElement, html: string, ms = 1800) {
  const node = el('div', 'panel toast');
  node.innerHTML = html;
  parent.appendChild(node);
  setTimeout(() => {
    node.style.transition = 'opacity .3s linear';
    node.style.opacity = '0';
    setTimeout(() => remove(node), 320);
  }, ms);
  return node;
}
