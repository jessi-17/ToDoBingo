/**
 * The faces the text tool offers, in the order they appear in the picker.
 *
 * Each one is a different *voice* rather than a different weight of the same
 * one — a scrawl, a script, a serif, a typewriter, and so on — so the choice is
 * obvious from the sample alone and nobody has to read the labels.
 *
 * The families are the CSS variables `next/font/local` produces in
 * `src/app/fonts.ts`; nothing here assumes a font is installed on the visitor's
 * machine. Order matters: the first entry is what a new note starts as.
 */
export type NoteFontId =
  | "scribble"
  | "script"
  | "serif"
  | "mono"
  | "display"
  | "poster"
  | "round";

export const NOTE_FONTS: {
  id: NoteFontId;
  label: string;
  family: string;
  /** Multiplier on the note's size, so every face reads at the same weight. */
  scale: number;
}[] = [
  { id: "scribble", label: "Scribble", family: "var(--font-scribble)", scale: 1 },
  { id: "script", label: "Script", family: "var(--font-script)", scale: 1.15 },
  { id: "serif", label: "Serif", family: "var(--font-serif-note)", scale: 1 },
  { id: "mono", label: "Mono", family: "var(--font-mono-card)", scale: 0.95 },
  { id: "display", label: "Display", family: "var(--font-display)", scale: 1 },
  { id: "poster", label: "Poster", family: "var(--font-poster)", scale: 1.1 },
  { id: "round", label: "Round", family: "var(--font-round)", scale: 0.9 },
];

export const noteFont = (id: NoteFontId) =>
  NOTE_FONTS.find((font) => font.id === id) ?? NOTE_FONTS[0];

/**
 * A text box dropped on the page.
 *
 * Position is the note's *centre* as a fraction of the page, and both sizes are
 * in artboard units — the same rule stickers follow, so a note keeps its place
 * and its proportions at any viewport.
 */
export type Note = {
  key: string;
  text: string;
  xPct: number;
  yPct: number;
  font: NoteFontId;
  /** Font size, in artboard units. */
  size: number;
  /** Box width in artboard units. Undefined until dragged: hug the text. */
  width?: number;
  color: string;
  /** Degrees clockwise. */
  rotation: number;
};

export const NOTE_MIN_SIZE = 8;
export const NOTE_MAX_SIZE = 180;
export const NOTE_MIN_WIDTH = 56;
export const NOTE_MAX_WIDTH = 1500;
