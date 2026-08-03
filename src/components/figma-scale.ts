/**
 * Shared scaling for anything lifted straight out of the Figma artboard.
 *
 * `--s` is one artboard pixel expressed in real pixels, derived from the height
 * of the nearest size container (the notepad artwork). Writing every dimension
 * as `s(n)` keeps components at their designed proportions on any screen, and
 * keeps them locked to the artwork rather than drifting against it.
 */
export const ARTBOARD_HEIGHT = 1117;

/** The Figma "To-do-List" frame these coordinates were measured against. */
export const ARTBOARD_WIDTH = 2105;

export const s = (n: number) => `calc(${n} * var(--s, 1px))`;

/** Sets `--s` on an element inside the notepad's size container. */
export const scaleVars = {
  "--s": `calc(100cqh / ${ARTBOARD_HEIGHT})`,
} as React.CSSProperties;

/**
 * Tool panels run a touch smaller than the artboard, so they read as UI resting
 * on the page rather than competing with it.
 *
 * Shrinking `--s` rather than applying a transform means the panel, its text,
 * its icons and its stickers all scale together by construction — and because
 * nothing is transformed, drag maths still works in plain pixels.
 */
export const PANEL_SCALE = 0.88;

export const panelScaleVars = {
  "--s": `calc(100cqh / ${ARTBOARD_HEIGHT} * ${PANEL_SCALE})`,
} as React.CSSProperties;

/**
 * Rendered height of the notebook frame's top band — the binding rings. Owned
 * here because the portrait layout positions against it: the band grows and
 * shrinks with the window, so anything anchored to a fixed percentage of the
 * page walks off the rings or under them.
 */
export const FRAME_TOP = "min(10.5vh, 16vw)";

/**
 * Scale for a panel shown as a bottom sheet on the portrait layout: one
 * artboard pixel chosen so a panel designed `units` wide fills most of the
 * container's width. Capped at design size, so a sheet on a merely squarish
 * window never blows up past the artwork it was traced from.
 */
export const sheetScaleVars = (units: number, fraction = 0.94) =>
  ({
    "--s": `min(calc(${fraction * 100}cqw / ${units}), 1px)`,
  }) as React.CSSProperties;

/**
 * The portrait toolbar's designed width: seven 58-unit slots, six 10-unit
 * gaps, 16 of padding a side. Owned here because the sheets need the same
 * numbers — a sheet's resting place is just above the toolbar, and the
 * toolbar's height is set by its content, not by the page.
 */
export const TOOLBAR_UNITS = 7 * 58 + 6 * 10 + 2 * 16;

const TOOLBAR_SCALE = `min(calc(97cqw / ${TOOLBAR_UNITS}), 1px)`;

/**
 * Where a bottom sheet's lower edge sits: the toolbar's 1.2% inset, plus its
 * ~103-unit height (48 icon + 17 label + padding and border) at the toolbar's
 * own scale, plus a sliver of paper between the two.
 */
export const SHEET_BOTTOM = `calc(1.2% + 103 * ${TOOLBAR_SCALE} + 8px)`;

/**
 * Stacking order for the page. Panels must clear the decorative layers — the
 * stars, the name beads and the wordmark — which otherwise paint over them.
 */
export const PANEL_Z = "z-45";

/**
 * The frame shared by the sidebar and the popups.
 *
 * Figma's Glass effect is reconstructed rather than copied — the REST API
 * returns it as bare `{type: "GLASS"}` with no refraction, depth or dispersion
 * values to read. Four things together sell it:
 *
 *  1. blur + saturate + brightness on the backdrop — the frost and the vibrancy
 *     boost that makes glass look lit rather than merely translucent.
 *  2. A bright rim on the top inner edge and a softer one along the bottom,
 *     standing in for the way a bevel refracts light back at the viewer.
 *  3. A diagonal specular sheen, applied as a background-image so it layers over
 *     the fill but under the content with no stacking-order games.
 *  4. Figma's own two inner shadows, kept underneath for the pressed depth.
 */
export const panelStyle = {
  borderRadius: s(29),
  borderWidth: s(2),
  backgroundColor: "rgba(223, 243, 128, 0.44)",
  backgroundImage:
    "linear-gradient(135deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.14) 30%, rgba(255,255,255,0) 58%)",
  backdropFilter: "blur(14px) saturate(185%) brightness(1.06)",
  WebkitBackdropFilter: "blur(14px) saturate(185%) brightness(1.06)",
  // Earlier shadows paint on top, so the rim highlights lead.
  boxShadow: [
    `inset 0 ${s(1)} ${s(1)} rgba(255,255,255,0.65)`,
    `inset 0 ${s(-1)} ${s(1.5)} rgba(255,255,255,0.30)`,
    `inset 0 ${s(-2)} ${s(4)} rgba(0,0,0,0.12)`,
    `inset 0 ${s(2)} ${s(4)} rgba(0,0,0,0.10)`,
  ].join(", "),
} as React.CSSProperties;

export const panelClass = "border-[#f6afc4]";

/**
 * Alte Haas Grotesk, Gabriel Serif Condensed, Cheri Liney and The Wildeast are
 * all used in the design and none are Google Fonts or installed locally. Drop
 * the files into the project and load them with next/font/local to close this.
 */
export const bodyFont =
  '"Alte Haas Grotesk", var(--font-geist-sans), "Helvetica Neue", Arial, sans-serif';

export const displayFont =
  '"Gabriel Serif Condensed", Georgia, "Times New Roman", serif';

export const markerFont = '"Cheri Liney", "Comic Sans MS", cursive';
