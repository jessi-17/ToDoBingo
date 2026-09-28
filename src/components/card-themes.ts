/**
 * The card's colourways.
 *
 * Only colour changes between them. Geometry, type, stickers and the texture
 * passes are the design and stay put — which is also what keeps a theme cheap:
 * both renderers already read their three fills from here, so a new colourway
 * is one entry in this list and nothing else.
 *
 * Kept to the original's recipe: a light body, a saturated panel for the grid
 * to sit on, and a third colour for the BINGO tiles, all loud enough to hold a
 * black keyline and black lettering.
 */
export type CardTheme = {
  id: string;
  name: string;
  /** The card's body. */
  card: string;
  /** The panel behind the grid. */
  panel: string;
  /** The BINGO letter tiles. */
  tile: string;
};

export const CARD_THEMES = [
  { id: "lime", name: "Lime Pop", card: "#e0f380", panel: "#fdaaf8", tile: "#93d1fc" },
  { id: "bubblegum", name: "Bubblegum", card: "#ffc9e6", panel: "#9fe8c9", tile: "#fff27a" },
  { id: "lavender", name: "Lavender Haze", card: "#d8cbff", panel: "#ffe27a", tile: "#ff9fc4" },
  { id: "sky", name: "Cherry Sky", card: "#aee0ff", panel: "#ff9f8f", tile: "#d9f77f" },
] as const satisfies readonly CardTheme[];

export type ThemeId = (typeof CARD_THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "lime";

/** Falls back to the original, so a card saved with a theme since removed still opens. */
export const cardTheme = (id: string | undefined): CardTheme =>
  CARD_THEMES.find((theme) => theme.id === id) ?? CARD_THEMES[0];

/** Any theme but the one showing, so a shuffle always visibly changes the card. */
export const shuffleTheme = (current: string | undefined): ThemeId => {
  const others = CARD_THEMES.filter((theme) => theme.id !== current);
  return others[Math.floor(Math.random() * others.length)].id;
};
