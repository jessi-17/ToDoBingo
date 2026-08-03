import localFont from "next/font/local";

/**
 * The design's own faces, bundled rather than assumed.
 *
 * Both were installed on the design machine, which means they render there and
 * nowhere else — a visitor without them would silently fall back. Shipping the
 * files is what actually makes the design travel.
 *
 * LICENSING — read before this goes public. Serving a font from a website is
 * redistribution, which most of these cuts do not permit:
 *
 *   Recoleta      DEMO release        evaluation only — needs a licensed copy
 *   Aston Script  unknown             likely personal-use; verify or replace
 *   Gabriel Serif unknown             verify or replace
 *   Lemon Milk    free personal use   web use normally needs the paid licence
 *   Barriecito    SIL OFL             fine to ship
 *   Bebas Neue    SIL OFL             fine to ship
 *   ConsolaMono   SIL OFL             fine to ship
 *
 * The two OFL faces below are safe; the rest are placeholders that work now and
 * have to be cleared or swapped before launch.
 */
export const consolaMono = localFont({
  src: [
    { path: "../fonts/ConsolaMono-Book.ttf", weight: "400", style: "normal" },
    { path: "../fonts/ConsolaMono-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-mono-card",
  display: "swap",
});

export const recoleta = localFont({
  src: [
    { path: "../fonts/Recoleta-RegularDEMO.otf", weight: "400", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
});

/**
 * The extra faces the text tool offers. Each is loaded on its own variable so a
 * note can name one directly; `preload: false` keeps them off the critical path,
 * since a visitor who never opens the text tool should not pay for six fonts.
 */
export const barriecito = localFont({
  src: [{ path: "../fonts/Barriecito-Regular.ttf", weight: "400", style: "normal" }],
  variable: "--font-scribble",
  display: "swap",
  preload: false,
});

export const astonScript = localFont({
  src: [{ path: "../fonts/AstonScript-Regular.ttf", weight: "400", style: "normal" }],
  variable: "--font-script",
  display: "swap",
  preload: false,
});

export const gabrielSerif = localFont({
  src: [{ path: "../fonts/GabrielSerif-Regular.ttf", weight: "400", style: "normal" }],
  variable: "--font-serif-note",
  display: "swap",
  preload: false,
});

export const bebasNeue = localFont({
  src: [{ path: "../fonts/BebasNeue-Regular.ttf", weight: "400", style: "normal" }],
  variable: "--font-poster",
  display: "swap",
  preload: false,
});

export const lemonMilk = localFont({
  src: [{ path: "../fonts/LemonMilk-Regular.otf", weight: "400", style: "normal" }],
  variable: "--font-round",
  display: "swap",
  preload: false,
});
