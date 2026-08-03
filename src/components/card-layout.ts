/**
 * The bingo card's geometry, from Figma node 128:689.
 *
 * Everything is written in the card's own 645x803 coordinates, so a single
 * factor scales the whole design and every proportion in it is preserved
 * exactly at any size — rather than re-deriving each measurement in percentages
 * and watching them drift apart.
 *
 * These numbers live apart from the component because the card is drawn twice:
 * once as DOM for the screen, and once into a canvas for the file the user
 * downloads. Two renderers reading two copies of the layout is a guarantee they
 * will disagree eventually; this way the only thing that can differ between the
 * screen and the export is styling, never position.
 *
 * The design stacks four separate texture passes, each with its own blend mode
 * and opacity. They are what stop the card reading as flat vector shapes, so
 * both renderers reproduce them rather than approximating:
 *
 *   green frame  linear-burn @ 31%   over the lime card
 *   pink frame   overlay     @ 41%   over the pink panel
 *   grain x4     overlay     @ 18%   scattered inside the pink panel
 *   letter tile  exclusion   @ 18%   inside each BINGO tile
 */
export const CARD_W = 645;
export const CARD_H = 803;

export const CARD_BG = "#e0f380";
export const PANEL_BG = "#fdaaf8";
export const TILE_BG = "#93d1fc";
export const INK = "#3d0e26";

/** Grid: 25 cells of 103 at ~105.4 pitch, starting at 60,195 on the card. */
export const GRID = { x: 60, y: 195, cell: 103, pitchX: 105.4, pitchY: 105.25 };

export const PANEL = { x: 52, y: 187, w: 541, h: 539, r: 12 };

/** BINGO tiles: the I is narrower, as in the design. */
export const LETTERS = [
  { id: "B", file: "B", x: 72, w: 104, lw: 56, lh: 73, ly: 17 },
  { id: "I", file: "I", x: 182, w: 59, lw: 13, lh: 75, ly: 17 },
  { id: "N", file: "N", x: 247, w: 104, lw: 61, lh: 75, ly: 17 },
  { id: "G", file: "Vector 8", x: 358, w: 104, lw: 67, lh: 77, ly: 15 },
  { id: "O", file: "O", x: 468, w: 104, lw: 70, lh: 79, ly: 15 },
];

export const TILE = { y: 79, h: 108 };

/** Where the two headings sit, and how big they are set. */
export const TITLE = { y: 27, size: 24, line: 33 };
export const FOOTER = { y: 739, size: 24, line: 33 };

/** A square's own type. Dropped text is sized to fit instead; see `fitSize`. */
export const CELL_TEXT = { size: 14, line: 16, pad: 8, padDropped: 6, radius: 12 };

/**
 * Stickers scattered over the card, in card coordinates, matching where they
 * sit in the reference render.
 */
export const STICKERS = [
  // Sits above the tiles: the O starts at y=79, so this has to end before it.
  { src: "/2026.png", x: 488, y: 8, w: 104, h: 66, tilt: -4 },
  { src: "/cat.png", x: 462, y: 474, w: 86, h: 74, tilt: 6 },
];

/**
 * The card's own sparkles — part of the artwork, not page decoration. Positions
 * read off the Figma render, in card coordinates.
 */
export const SPARKS = [
  { shape: 0, x: 18, y: 20, size: 58, tilt: -10 },
  { shape: 1, x: 592, y: 160, size: 54, tilt: 12 },
  { shape: 1, x: 138, y: 398, size: 48, tilt: -14 },
  { shape: 2, x: 500, y: 606, size: 52, tilt: 8 },
  { shape: 3, x: 16, y: 752, size: 54, tilt: -8 },
];

/** The four grain patches inside the pink panel, in card coordinates. */
export const GRAIN = [
  { x: 32, y: 187, size: 329 },
  { x: 303, y: 483, size: 329 },
  { x: 356, y: 176, size: 329 },
  { x: -6, y: 505, size: 329 },
];

/** The full-bleed texture passes, in card coordinates. */
export const OVERLAY = {
  green: { src: "/bingo/overlay-green.webp", w: CARD_W, h: 1146, y: -171, alpha: 0.31 },
  pink: { src: "/bingo/overlay-pink.webp", w: PANEL.w, h: 962, y: -211, alpha: 0.41 },
  grain: { src: "/bingo/overlay-grain.webp", alpha: 0.18 },
};

/**
 * The strike that lands on a completed square: six passes back and forth,
 * written as one continuous stroke. Being a single path is what lets the pencil
 * be sent along the *identical* geometry via `offset-path`, so the tip and the
 * leading edge of the ink can never drift apart.
 *
 * Drawn in the square's own 100x100 viewBox, inset to clear the rounded corners.
 */
export const SCRIBBLE =
  "M 10 26 C 34 18, 62 30, 90 24 C 66 34, 30 32, 12 42 C 40 40, 74 48, 90 44 " +
  "C 62 54, 26 52, 10 62 C 38 60, 72 70, 90 66 C 60 78, 28 74, 12 84";

export const SCRIBBLE_WIDTH = 4.2;

/** How long the pencil takes to cross a square. The glass follows it. */
export const SCRIBBLE_MS = 620;
