/**
 * Dialogue data. The runner lives in `src/ui/DialogueBox.ts` — this module is
 * pure data so `src/data/*` can build scripts without importing the UI layer.
 */

export interface DialogueLine {
  /** Displayed in the name tag. Omit for narration. */
  speaker?: string;
  text: string;
}

export type DialogueScript = DialogueLine[];

/** Convenience: one speaker, many lines. */
export function say(speaker: string, ...lines: string[]): DialogueScript {
  return lines.map((text) => ({ speaker, text }));
}

/** Narration (no name tag). */
export function narrate(...lines: string[]): DialogueScript {
  return lines.map((text) => ({ text }));
}
