/** Tiny DOM helpers for the overlay UI. No framework needed (plan §1). */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  html?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

export function clear(node: HTMLElement) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function remove(node: HTMLElement | null | undefined) {
  node?.parentElement?.removeChild(node);
}

/** Escapes text destined for innerHTML. */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** `<i>` fill element for a bar; returns a setter for 0..1. */
export function bar(parent: HTMLElement, kind: 'hp' | 'mp'): (pct: number) => void {
  const wrap = el('div', `bar ${kind}`);
  const fill = el('i');
  wrap.appendChild(fill);
  parent.appendChild(wrap);
  return (pct: number) => {
    const p = Math.max(0, Math.min(1, pct));
    fill.style.width = `${p * 100}%`;
    wrap.classList.toggle('low', p <= 0.25);
  };
}

/**
 * A labelled meter: `HP ▓▓▓▓░░ 41/59`. Returns a setter taking current/max.
 * The label sits beside the bar rather than above it so a fighter card reads in
 * two lines instead of five.
 */
export function meter(parent: HTMLElement, kind: 'hp' | 'mp', label: string): (cur: number, max: number) => void {
  const row = el('div', `meter ${kind}`);
  row.appendChild(el('span', 'meter-label', label));
  const wrap = el('div', `bar ${kind}`);
  const fill = el('i');
  wrap.appendChild(fill);
  row.appendChild(wrap);
  const value = el('span', 'meter-value');
  row.appendChild(value);
  parent.appendChild(row);
  return (cur: number, max: number) => {
    const p = Math.max(0, Math.min(1, max > 0 ? cur / max : 0));
    fill.style.width = `${p * 100}%`;
    row.classList.toggle('low', p <= 0.25);
    value.textContent = `${Math.max(0, Math.round(cur))}/${Math.round(max)}`;
  };
}
