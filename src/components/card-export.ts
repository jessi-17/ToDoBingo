import { EMPTY_CELL, fitSize, withAlpha, type BoardCell } from "./board";
import { renderStroke, type Doodle } from "./doodle-brushes";
import { ARTBOARD_HEIGHT } from "./figma-scale";
import { noteFont, type Note } from "./note-fonts";
import { type Placed } from "./placed-sticker";
import {
  CARD_BG,
  CARD_H,
  CARD_W,
  CELL_TEXT,
  FOOTER,
  GRAIN,
  GRID,
  INK,
  LETTERS,
  OVERLAY,
  PANEL,
  PANEL_BG,
  SCRIBBLE,
  SCRIBBLE_WIDTH,
  SPARKS,
  STICKERS,
  TILE,
  TILE_BG,
  TITLE,
} from "./card-layout";
import { STAR_SHAPES } from "./star-shapes";

/**
 * Draws the bingo card into a canvas, for the file the user takes away.
 *
 * Painted by hand rather than screenshotted out of the DOM. The obvious route —
 * html2canvas or html-to-image — cannot render this card: it leans on
 * `mix-blend-mode` for all four of its texture passes and on `backdrop-filter`
 * for the frost, and those libraries reimplement CSS layout in JavaScript and
 * support neither. The result would be a flat, textureless copy of a card whose
 * whole character is the texture.
 *
 * Canvas 2D, by contrast, has multiply, overlay and exclusion natively, so the
 * passes composite exactly as they do on screen. Everything is same-origin, so
 * nothing taints the canvas and `toBlob` works.
 *
 * Geometry comes from ./card-layout, the same module the on-screen card reads.
 */

/**
 * Paints the page's own artwork onto the card, in card coordinates.
 *
 * The projection is one transform: page pixels scaled down by the ratio between
 * the card's on-screen size and its design size, with the card's own origin
 * subtracted. Everything drawn after it can be written in the page's pixel
 * space and lands in the right place on the card, at the right size, whatever
 * the window happened to be.
 *
 * Order matches the page's stacking: stickers, then ink, then notes.
 */
async function drawOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: OverlayArt,
) {
  const { card, page } = overlay;
  if (!card.w || !card.h) return;

  /** Card design units per page pixel. */
  const project = () => {
    ctx.scale(CARD_W / card.w, CARD_H / card.h);
    ctx.translate(-card.x, -card.y);
  };
  /** One artboard unit in page pixels — how the page sizes its furniture. */
  const unit = page.h / ARTBOARD_HEIGHT;

  // Nothing may spill past the card's edge; on the page it simply carries on
  // over the paper, but here the card *is* the picture.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, CARD_W, CARD_H);
  ctx.clip();

  // --- stickers ------------------------------------------------------------
  const stickers = await Promise.all(
    overlay.stickers.map((sticker) => load(sticker.src)),
  );
  overlay.stickers.forEach((sticker, index) => {
    const image = stickers[index];
    if (!image) return;
    // Longest edge is `size`, matching how the page lays them out.
    const w = (sticker.aspect >= 1 ? sticker.size : sticker.size * sticker.aspect) * unit;
    const h = (sticker.aspect >= 1 ? sticker.size / sticker.aspect : sticker.size) * unit;

    ctx.save();
    project();
    ctx.translate(sticker.xPct * page.w, sticker.yPct * page.h);
    ctx.rotate((sticker.rotation * Math.PI) / 180);
    ctx.drawImage(image, -w / 2, -h / 2, w, h);
    ctx.restore();
  });

  // --- ink -----------------------------------------------------------------
  const ink = overlay.doodles.filter((d) => !d.erase);
  const cuts = overlay.doodles.filter((d) => d.erase);

  if (ink.length) {
    /*
     * Drawn into a scratch layer first so the eraser can be applied as
     * `destination-out` before any of it touches the card. Rubbing directly on
     * the card would punch holes through the artwork underneath, which is the
     * opposite of what the eraser does on screen — there it only lifts ink.
     */
    const layer = document.createElement("canvas");
    layer.width = Math.max(1, Math.round(page.w));
    layer.height = Math.max(1, Math.round(page.h));
    const lc = layer.getContext("2d");

    if (lc) {
      const paint = (list: Doodle[]) =>
        list.forEach((doodle) =>
          renderStroke(doodle, page.w, page.h).forEach((path) => {
            lc.globalAlpha = path.opacity;
            lc.fillStyle = doodle.color;
            // Outlines are filled, not stroked: that is what carries the width
            // variation the brush engine produces.
            lc.fill(new Path2D(path.d));
          }),
        );

      paint(ink);
      lc.globalCompositeOperation = "destination-out";
      paint(cuts);

      ctx.save();
      project();
      ctx.drawImage(layer, 0, 0, page.w, page.h);
      ctx.restore();
    }
  }

  // --- loose text notes ----------------------------------------------------
  if (overlay.notes.length) await document.fonts.ready;

  overlay.notes.forEach((note) => {
    const text = note.text.trim();
    if (!text) return;

    const face = noteFont(note.font);
    const size = note.size * face.scale * unit;

    ctx.save();
    project();
    ctx.translate(note.xPct * page.w, note.yPct * page.h);
    ctx.rotate((note.rotation * Math.PI) / 180);

    ctx.fillStyle = note.color;
    ctx.font = `${size}px ${family(face.family, "sans-serif")}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const lines = note.width
      ? wrap(ctx, text, note.width * unit)
      : text.split("\n");
    const lineHeight = size * 1.25;
    const top = -((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, n) => ctx.fillText(line, 0, top + n * lineHeight));
    ctx.restore();
  });

  ctx.restore();
}

/** One design pixel is one canvas unit; `scale` sets how many device pixels. */
const load = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    // A missing decoration must not cost the user their download.
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });

/**
 * Resolves a CSS font stack to something `ctx.font` accepts.
 *
 * The faces are loaded by next/font, whose family names are generated at build
 * time and only reachable through the custom properties it defines — so a
 * `var(--font-x)` has to be looked up against the document rather than passed
 * through, or canvas silently falls back to sans-serif.
 */
const family = (value: string | undefined, fallback: string) => {
  if (!value) return fallback;
  const variable = /var\((--[\w-]+)\)/.exec(value);
  if (!variable) return value;
  const resolved = getComputedStyle(document.documentElement)
    .getPropertyValue(variable[1])
    .trim();
  return resolved || fallback;
};

/** Greedy wrap. Canvas has no line breaking of its own. */
const wrap = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) => {
  const lines: string[] = [];
  let line = "";

  for (const word of text.split(/\s+/).filter(Boolean)) {
    // A single word wider than the box has no space to break at, so it is
    // broken at whatever character fits — matching the screen's
    // `overflow-wrap: anywhere`, and keeping the export inside its square.
    if (ctx.measureText(word).width > maxWidth) {
      if (line) {
        lines.push(line);
        line = "";
      }
      let piece = "";
      for (const chr of word) {
        if (piece && ctx.measureText(piece + chr).width > maxWidth) {
          lines.push(piece);
          piece = chr;
        } else {
          piece += chr;
        }
      }
      line = piece;
      continue;
    }

    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
};

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radii: number | number[],
) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radii);
};

/** Paints `image` through a blend mode at an opacity, then restores state. */
const blend = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  mode: GlobalCompositeOperation,
  alpha: number,
  draw: (image: HTMLImageElement) => void,
) => {
  if (!image) return;
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = alpha;
  draw(image);
  ctx.restore();
};

/**
 * Everything the user put on top of the card by hand.
 *
 * These live on the *page*, not in the card — a doodle is drawn on one big
 * surface stretched over the whole notepad, and stickers and loose notes are
 * positioned as fractions of the page. That is right for editing (you can drag
 * a sticker off the card and back on) but it means the card component knows
 * nothing about them, and an export built only from the card comes out bare.
 *
 * So the geometry is measured at export time and handed over: where the card
 * sits inside the page, in the same pixel space the artwork is positioned in.
 * Everything overlapping is then projected into card coordinates and clipped.
 */
export type OverlayArt = {
  /** The card's box on screen, in CSS pixels. */
  card: { x: number; y: number; w: number; h: number };
  /** The page the artwork is positioned against, in CSS pixels. */
  page: { w: number; h: number };
  doodles: Doodle[];
  stickers: Placed[];
  notes: Note[];
};

export type CardArt = {
  cells: BoardCell[];
  title: string;
  footer: string;
  overlay?: OverlayArt;
};

/**
 * Renders the card at `scale` device pixels per design pixel.
 * 2 gives a 1290x1606 image, which is plenty for a phone screen or a print.
 */
export async function renderCard(art: CardArt, scale = 2) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(CARD_W * scale);
  canvas.height = Math.round(CARD_H * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser");
  ctx.scale(scale, scale);

  // Text is measured as well as drawn, so the faces have to be in before a
  // single glyph is laid out or every line wraps against the fallback metrics.
  await document.fonts.ready;

  const [green, pink, grain, ...art_] = await Promise.all([
    load(OVERLAY.green.src),
    load(OVERLAY.pink.src),
    load(OVERLAY.grain.src),
    ...LETTERS.map((letter) =>
      load(`/icons/bingo-letters/${encodeURIComponent(letter.file)}.svg`),
    ),
    ...STICKERS.map((sticker) => load(sticker.src)),
  ]);
  const letters = art_.slice(0, LETTERS.length);
  const stickers = art_.slice(LETTERS.length);

  const display = family("var(--font-display)", "Georgia, serif");
  const mono = family("var(--font-mono-card)", "monospace");

  // --- card body -----------------------------------------------------------
  ctx.fillStyle = CARD_BG;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Figma specifies Linear Burn, which CSS and canvas both lack; multiply is
  // the nearest of the sixteen in the spec, and the screen uses it too.
  blend(ctx, green, "multiply", OVERLAY.green.alpha, (image) =>
    ctx.drawImage(image, 0, OVERLAY.green.y, OVERLAY.green.w, OVERLAY.green.h),
  );

  // --- headings ------------------------------------------------------------
  const heading = (text: string, at: { y: number; size: number; line: number }) => {
    ctx.fillStyle = "#000000";
    ctx.font = `${at.size}px ${display}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, CARD_W / 2, at.y + at.line / 2, PANEL.w);
  };
  heading(art.title, TITLE);

  // --- BINGO tiles ---------------------------------------------------------
  LETTERS.forEach((letter, index) => {
    ctx.save();
    // Rounded at the top only — the bottom tucks behind the pink panel.
    roundRect(ctx, letter.x, TILE.y, letter.w, TILE.h, [16, 16, 0, 0]);
    ctx.fillStyle = TILE_BG;
    ctx.fill();
    ctx.clip();

    blend(ctx, grain, "exclusion", OVERLAY.grain.alpha, (image) =>
      ctx.drawImage(image, letter.x - 18, TILE.y - 119, 240, 240),
    );

    const glyph = letters[index];
    if (glyph) {
      ctx.drawImage(
        glyph,
        letter.x + (letter.w - letter.lw) / 2,
        TILE.y + letter.ly,
        letter.lw,
        letter.lh,
      );
    }
    ctx.restore();

    roundRect(ctx, letter.x, TILE.y, letter.w, TILE.h, [16, 16, 0, 0]);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // --- pink panel ----------------------------------------------------------
  ctx.save();
  roundRect(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, PANEL.r);
  ctx.fillStyle = PANEL_BG;
  ctx.fill();
  ctx.clip();
  blend(ctx, pink, "overlay", OVERLAY.pink.alpha, (image) =>
    ctx.drawImage(
      image,
      PANEL.x,
      PANEL.y + OVERLAY.pink.y,
      OVERLAY.pink.w,
      OVERLAY.pink.h,
    ),
  );
  ctx.restore();
  roundRect(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, PANEL.r);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.stroke();

  // --- squares -------------------------------------------------------------
  const strike = new Path2D(SCRIBBLE);

  for (let i = 0; i < 25; i++) {
    const cell = art.cells[i] ?? EMPTY_CELL;
    const x = GRID.x + (i % 5) * GRID.pitchX;
    const y = GRID.y + Math.floor(i / 5) * GRID.pitchY;
    const dropped = Boolean(cell.font);
    const pad = dropped ? CELL_TEXT.padDropped : CELL_TEXT.pad;

    roundRect(ctx, x, y, GRID.cell, GRID.cell, CELL_TEXT.radius);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    if (cell.done) {
      /*
       * The frost, without a backdrop filter — canvas has no such thing. It
       * does not need one: the only things under the glass are the square's
       * flat white and the scribble, so blurring the scribble as it goes down
       * and washing the tint over the top lands in the same place as blurring
       * the composited result would.
       */
      ctx.save();
      roundRect(ctx, x, y, GRID.cell, GRID.cell, CELL_TEXT.radius);
      ctx.clip();
      ctx.translate(x, y);
      ctx.scale(GRID.cell / 100, GRID.cell / 100);
      ctx.filter = `blur(${(3.4 * 100) / GRID.cell}px)`;
      ctx.strokeStyle = INK;
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = SCRIBBLE_WIDTH;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke(strike);
      ctx.restore();

      ctx.save();
      roundRect(ctx, x, y, GRID.cell, GRID.cell, CELL_TEXT.radius);
      ctx.clip();
      ctx.fillStyle = "rgba(255, 253, 247, 0.28)";
      ctx.fillRect(x, y, GRID.cell, GRID.cell);
      ctx.fillStyle = withAlpha(cell.tint, 0.3);
      ctx.fillRect(x, y, GRID.cell, GRID.cell);
      ctx.restore();
    }

    roundRect(ctx, x, y, GRID.cell, GRID.cell, CELL_TEXT.radius);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.stroke();

    if (!cell.label) continue;

    // Label above the frost, exactly as on screen and for the same reason:
    // this type is far too small to survive being blurred. Tasks shrink with
    // length past the standard size, exactly as the live card does.
    const size = dropped
      ? fitSize(cell.label)
      : Math.min(CELL_TEXT.size, fitSize(cell.label));
    const lineHeight =
      dropped || size < CELL_TEXT.size ? size * 1.15 : CELL_TEXT.line;
    ctx.save();
    ctx.globalAlpha = cell.done ? 0.72 : 1;
    ctx.fillStyle = dropped ? (cell.color ?? "#000000") : "#000000";
    ctx.font = `${size}px ${family(cell.font, mono)}`;
    ctx.textBaseline = "middle";

    const lines = wrap(ctx, cell.label, GRID.cell - pad * 2);

    if (dropped) {
      // Placed by hand, so it reads as centred in its box.
      ctx.textAlign = "center";
      const top = y + GRID.cell / 2 - ((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, n) =>
        ctx.fillText(line, x + GRID.cell / 2, top + n * lineHeight),
      );
    } else {
      // A task is set like print: flush left from the top of the square.
      ctx.textAlign = "left";
      lines.forEach((line, n) =>
        ctx.fillText(line, x + pad, y + pad + lineHeight / 2 + n * lineHeight),
      );
    }
    ctx.restore();
  }

  // --- grain patches, above the cells as in the design ---------------------
  GRAIN.forEach((patch) =>
    blend(ctx, grain, "overlay", OVERLAY.grain.alpha, (image) =>
      ctx.drawImage(image, patch.x, patch.y, patch.size, patch.size),
    ),
  );

  heading(art.footer, FOOTER);

  // --- stickers and sparkles ----------------------------------------------
  STICKERS.forEach((sticker, index) => {
    const image = stickers[index];
    if (!image) return;
    ctx.save();
    ctx.translate(sticker.x + sticker.w / 2, sticker.y + sticker.h / 2);
    ctx.rotate((sticker.tilt * Math.PI) / 180);
    ctx.drawImage(image, -sticker.w / 2, -sticker.h / 2, sticker.w, sticker.h);
    ctx.restore();
  });

  SPARKS.forEach((spark) => {
    const shape = STAR_SHAPES[spark.shape % STAR_SHAPES.length];
    const [vx, vy, vw, vh] = shape.viewBox.split(/\s+/).map(Number);

    ctx.save();
    ctx.translate(spark.x + spark.size / 2, spark.y + spark.size / 2);
    ctx.rotate((spark.tilt * Math.PI) / 180);
    // The paths are kept in their authored space, so project rather than
    // re-draw: scale the viewBox onto the sparkle's box and shift its origin.
    ctx.scale(spark.size / vw, spark.size / vh);
    ctx.translate(-vx - vw / 2, -vy - vh / 2);

    ctx.fillStyle = shape.fillColor;
    ctx.fill(new Path2D(shape.fill));
    ctx.strokeStyle = shape.stroke;
    ctx.lineWidth = shape.strokeWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke(new Path2D(shape.outline));
    ctx.restore();
  });

  // Last, and on top of everything: what the user drew, stuck and wrote over
  // the card is the part they will look for first.
  if (art.overlay) await drawOverlay(ctx, art.overlay);

  return canvas;
}

/** Instagram's story canvas. Anything else gets letterboxed by the app. */
export const STORY = { w: 1080, h: 1920 };

/**
 * The card centred on a story-shaped background, ready to post.
 *
 * Rendered as its own canvas rather than by scaling the card up: a story is
 * 9:16 and the card is roughly 4:5, so posting the card alone would leave
 * Instagram to letterbox it against whatever it feels like. Choosing the
 * surround means the margins are part of the design.
 */
export async function renderStory(art: CardArt, name?: string | null) {
  const canvas = document.createElement("canvas");
  canvas.width = STORY.w;
  canvas.height = STORY.h;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser");

  ctx.fillStyle = "#f79bec";
  ctx.fillRect(0, 0, STORY.w, STORY.h);

  const grain = await load(OVERLAY.grain.src);
  blend(ctx, grain, "overlay", 0.22, (image) => {
    for (let y = 0; y < STORY.h; y += 540) {
      for (let x = 0; x < STORY.w; x += 540) ctx.drawImage(image, x, y, 540, 540);
    }
  });

  const card = await renderCard(art, 2);
  const width = STORY.w * 0.84;
  const height = (width * CARD_H) / CARD_W;
  const x = (STORY.w - width) / 2;
  const y = (STORY.h - height) / 2;

  ctx.save();
  ctx.shadowColor = "rgba(61, 14, 38, 0.35)";
  ctx.shadowBlur = 44;
  ctx.shadowOffsetY = 16;
  ctx.drawImage(card, x, y, width, height);
  ctx.restore();

  if (name) {
    await document.fonts.ready;
    ctx.fillStyle = "#3d0e26";
    ctx.font = `72px ${family("var(--font-display)", "Georgia, serif")}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`${name}'s bingo`, STORY.w / 2, y - 64, STORY.w * 0.86);
  }

  return canvas;
}

/**
 * A small picture of the card, for the list of ones you have put away.
 *
 * Rendered at a fraction of the export scale and re-encoded as WebP, because
 * this is going into localStorage alongside the card it depicts — a full-size
 * PNG would be a megabyte of the ~5MB the whole origin gets. Overlay artwork is
 * deliberately included: a thumbnail without your doodles on it does not look
 * like the card you remember making.
 */
export async function renderThumb(art: CardArt) {
  const canvas = await renderCard(art, 0.42);
  return canvas.toDataURL("image/webp", 0.72);
}

export const toBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the image"))),
      "image/png",
    ),
  );

export const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Revoked on the next frame: doing it synchronously can beat the navigation.
  requestAnimationFrame(() => URL.revokeObjectURL(url));
};
