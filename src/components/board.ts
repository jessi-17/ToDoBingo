import { noteFont, type NoteFontId } from "./note-fonts";
import { type Task } from "./tasks";

/**
 * What the bingo card is made of.
 *
 * The card is a canvas, not a view of the to-do list: it is the thing that gets
 * exported at the end, so whatever lands on it becomes part of it. A square
 * therefore holds one of two things — a task borrowed from the list, or free
 * text dropped straight onto the board.
 *
 * A task square is a *reference*, never a copy. Its label and its struck state
 * are read back from the list every render, which is what makes crossing a task
 * off in either place cross it off in both. Copying the label in at drop time
 * would let the two drift apart the moment either side was edited.
 */
export type Slot =
  | { kind: "task"; id: number }
  | { kind: "note"; text: string; font: NoteFontId; color: string };

/** One square, resolved and ready to draw. */
export type BoardCell = {
  label: string;
  done: boolean;
  /** Row colour of the task behind this square; tints the frost when struck. */
  tint?: string;
  /** Set for dropped text, which keeps its own face rather than the card mono. */
  font?: string;
  color?: string;
};

export const EMPTY_CELL: BoardCell = { label: "", done: false };

/**
 * Turns what is stored into what is drawn.
 *
 * Used for the card on screen and for any card pulled back out of the archive,
 * so a saved board renders identically to a live one — this is the single place
 * that decides what a square actually says.
 */
export const resolveCells = (
  squares: (Slot | null)[],
  tasks: Task[],
  freeMarks: Iterable<number>,
): BoardCell[] => {
  const marks = new Set(freeMarks);

  return squares.map((slot, index) => {
    if (slot?.kind === "task") {
      const task = tasks.find((item) => item.id === slot.id);
      // The task may have been deleted from the list while it sat on the board.
      if (!task) return EMPTY_CELL;
      return { label: task.label, done: task.done, tint: task.color };
    }
    if (slot?.kind === "note") {
      return {
        label: slot.text,
        done: marks.has(index),
        font: noteFont(slot.font).family,
        color: slot.color,
      };
    }
    return { label: "", done: marks.has(index) };
  });
};

/**
 * The twelve ways to win: five rows, five columns, both diagonals. Precomputed
 * once rather than derived per click.
 */
export const LINES: number[][] = [
  ...Array.from({ length: 5 }, (_, r) => [0, 1, 2, 3, 4].map((c) => r * 5 + c)),
  ...Array.from({ length: 5 }, (_, c) => [0, 1, 2, 3, 4].map((r) => r * 5 + c)),
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
];

/** How many lines are complete, given which squares are struck. */
export const completedLines = (done: boolean[]) =>
  LINES.filter((line) => line.every((index) => done[index])).length;

/**
 * Text dropped into a square has to fit the square — it is 103 units across
 * with room for about 85 of type, and there is nowhere for an overflow to go.
 *
 * Chosen from the length rather than measured, because measuring means laying
 * the text out, reading it back and re-rendering, which is a loop per square on
 * every keystroke. Buckets are one pass and, for a box this small, land in the
 * same place: the difference between the two only shows up in fonts far wider
 * or narrower than the set on offer.
 */
export const fitSize = (text: string) => {
  const n = text.trim().length;
  if (n <= 6) return 20;
  if (n <= 12) return 16;
  if (n <= 22) return 13;
  if (n <= 36) return 11;
  if (n <= 60) return 9;
  return 7.5;
};

/**
 * `#rrggbb` to `rgba(...)`. Needed because the frost's tint has to be laid on
 * at low alpha over the glass, and CSS cannot add an alpha to a hex literal
 * without `color-mix`, whose behaviour over a translucent backdrop is not the
 * simple wash wanted here.
 */
export const withAlpha = (hex: string | undefined, alpha: number) => {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return `rgba(255, 253, 247, ${alpha})`;
  }
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
};
