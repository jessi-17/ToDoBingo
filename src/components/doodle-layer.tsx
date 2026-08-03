"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  renderStroke,
  shapePoints,
  TOOL_ICONS,
  type BrushId,
  type Doodle,
  type Point,
  type ShapeId,
  type StrokeStyle,
} from "./doodle-brushes";
import { type NoteFontId } from "./note-fonts";
import { sfx, type Friction } from "./sounds";

/**
 * The drawing surface. Sits over the page, transparent, and only takes pointer
 * events while a tool is in hand — otherwise every other tool would be
 * unclickable.
 *
 * Strokes are stored as page fractions and rendered into a 1000-unit viewBox,
 * so a drawing keeps its place and proportions when the window resizes.
 *
 * Erasing rubs away part of a stroke rather than deleting the whole thing. The
 * eraser is recorded as its own stroke and painted black into an SVG mask over
 * the ink, so anything beneath it disappears. Three alternatives were weighed:
 *
 *  - a canvas with `destination-out`, which is what fabric's EraserBrush does.
 *    True pixel erasing, but the drawing becomes a bitmap — and this page
 *    rescales with the viewport, so it would resample and blur on every resize.
 *  - boolean path subtraction (paper.js, polygon-clipping). Geometrically
 *    exact, but it would have to re-cut every pass of every stroke on each
 *    pointer move, and these outlines self-intersect, which those libraries
 *    handle poorly.
 *  - masking, used here. Resolution-independent, no dependency, and the erase
 *    marks scale with the page exactly like the ink does.
 */

/**
 * The notepad artwork is 2:1 and its container enforces that, so the viewBox
 * carries the same aspect. With a square viewBox stretched across a 2:1 box one
 * SVG unit was twice as wide as it was tall: strokes came out roughly double
 * the thickness travelling vertically versus horizontally, and a circle drew as
 * an ellipse. Matching the aspect makes a unit square again.
 */
const VIEW_W = 2000;
const VIEW_H = 1000;

export type DoodleTool = "pencil" | "eraser" | "text" | ShapeId | null;

export type PenSettings = {
  color: string;
  opacity: number;
  width: number;
  brush: BrushId;
  style: StrokeStyle;
  /** Artboard units. Kept apart from the pen so each resizes on its own. */
  eraser: number;
  /** The text tool's face and size. Colour is shared with the pen. */
  font: NoteFontId;
  fontSize: number;
};

const SHAPES: ShapeId[] = [
  "line",
  "rect",
  "ellipse",
  "triangle",
  "arrow",
  "star",
];

const isShape = (tool: DoodleTool): tool is ShapeId =>
  !!tool && SHAPES.includes(tool as ShapeId);

export const ERASER_MIN = 8;
export const ERASER_MAX = 140;
export const ERASER_STEP = 6;

/** Even and round — an eraser should not taper or scatter like a brush. */
const eraserStroke = (points: Point[], width: number): Doodle => ({
  id: 0,
  points,
  color: "#000000",
  opacity: 1,
  width,
  brush: "blockbuster",
  style: "solid",
  erase: true,
});

/**
 * The armed shape, drawn into the cursor itself, so it is obvious you are about
 * to drag out a star rather than scribble. A plain crosshair says nothing about
 * which tool is in hand. The white underlay keeps it readable on any colour.
 */
const shapeCursor = (shape: ShapeId) => {
  const d = TOOL_ICONS[shape];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="-2 -2 28 28">` +
    `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="#3d0e26" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 15 15, crosshair`;
};

export default function DoodleLayer({
  tool,
  pen,
  setPen,
  doodles,
  setDoodles,
  onPlaceText,
}: {
  tool: DoodleTool;
  pen: PenSettings;
  setPen: React.Dispatch<React.SetStateAction<PenSettings>>;
  doodles: Doodle[];
  setDoodles: React.Dispatch<React.SetStateAction<Doodle[]>>;
  /** Where the text tool was clicked, as a fraction of the page. */
  onPlaceText?: (xPct: number, yPct: number) => void;
}) {
  const surface = useRef<SVGSVGElement>(null);
  const [drawing, setDrawing] = useState<Point[] | null>(null);
  const [anchor, setAnchor] = useState<Point | null>(null);
  /** Pointer position, for the eraser's size ring. */
  const [hover, setHover] = useState<Point | null>(null);
  const nextId = useRef(1);
  /** The stroke's friction voice, and where the hand last was for its speed. */
  const rub = useRef<Friction | null>(null);
  const rubLast = useRef<{ x: number; y: number; t: number } | null>(null);
  const maskId = useId();

  /**
   * Ctrl/Cmd with + or − resizes the eraser. Those are the browser's own zoom
   * shortcuts, so the default has to be suppressed or the whole page scales
   * instead. Bare [ and ] work too, for anyone who does not want a modifier.
   */
  const erasing = tool === "eraser";

  useEffect(() => {
    if (!erasing) return;

    const onKey = (event: KeyboardEvent) => {
      const modified = event.ctrlKey || event.metaKey;
      const grow =
        (modified && (event.key === "+" || event.key === "=")) ||
        event.key === "]";
      const shrink =
        (modified && (event.key === "-" || event.key === "_")) ||
        event.key === "[";
      if (!grow && !shrink) return;

      event.preventDefault();
      setPen((current) => ({
        ...current,
        eraser: Math.min(
          ERASER_MAX,
          Math.max(
            ERASER_MIN,
            current.eraser + (grow ? ERASER_STEP : -ERASER_STEP),
          ),
        ),
      }));
    };

    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, [erasing, setPen]);

  const toPage = (event: React.PointerEvent): Point | null => {
    const box = surface.current?.getBoundingClientRect();
    if (!box) return null;
    return {
      x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height,
    };
  };

  const start = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!tool) return;
    const at = toPage(event);
    if (!at) return;

    // Text is placed by a single click, not dragged out. Capturing the pointer
    // would steal the focus the new note is about to take.
    if (tool === "text") {
      // The page clears the current selection on its own pointerdown; letting
      // this reach it would deselect the note being created a moment later.
      event.stopPropagation();
      /*
       * And the *browser's* default for this press is to move focus to whatever
       * was clicked — here, this surface. That would land immediately after the
       * new note has taken the caret, blurring it while it is still empty, at
       * which point it is swept up as a stray click and vanishes. Suppressing
       * the compatibility mouse event leaves the focus where React put it.
       */
      event.preventDefault();
      onPlaceText?.(at.x, at.y);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);

    if (isShape(tool)) {
      sfx.pickup();
      setAnchor(at);
      setDrawing([]);
      return;
    }
    // Pencil and eraser rub the paper for as long as the stroke lasts; the
    // voice is fed the hand's speed on every move and silenced on release.
    rub.current?.end();
    rub.current = tool === "eraser" ? sfx.eraser() : sfx.pencil();
    rubLast.current = { x: at.x, y: at.y, t: performance.now() };
    setDrawing([at]);
  };

  const move = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!tool) return;
    const at = toPage(event);
    if (!at) return;
    if (erasing) setHover(at);
    if (!drawing) return;

    if (isShape(tool)) {
      if (anchor) setDrawing(shapePoints(tool, anchor, at).points);
      return;
    }
    // Feed the friction voice the hand's speed, in page-widths per moment —
    // a fast scribble hisses, a slow careful line barely whispers.
    const lastRub = rubLast.current;
    const now = performance.now();
    if (lastRub) {
      const dt = Math.max(now - lastRub.t, 1);
      const dist = Math.hypot(at.x - lastRub.x, at.y - lastRub.y);
      rub.current?.move(Math.min((dist / dt) * 1800, 1));
    }
    rubLast.current = { x: at.x, y: at.y, t: now };

    // Skip points too close to the last to keep paths light.
    const last = drawing.at(-1);
    if (last && Math.hypot(last.x - at.x, last.y - at.y) < 0.0015) return;
    setDrawing([...drawing, at]);
  };

  const end = (event: React.PointerEvent<SVGSVGElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    rub.current?.end();
    rub.current = null;
    rubLast.current = null;
    const at = toPage(event);

    if (isShape(tool) && anchor && at) {
      const built = shapePoints(tool, anchor, at);
      // Ignore a stray click that never became a drag.
      if (Math.hypot(at.x - anchor.x, at.y - anchor.y) > 0.004) {
        nextId.current += 1;
        setDoodles((current) => [
          ...current,
          {
            id: nextId.current,
            points: built.points,
            closed: built.closed,
            ...pen,
          },
        ]);
      }
    } else if (tool === "eraser" && drawing && drawing.length > 0) {
      nextId.current += 1;
      setDoodles((current) => [
        ...current,
        { ...eraserStroke(drawing, pen.eraser), id: nextId.current },
      ]);
    } else if (tool === "pencil" && drawing && drawing.length > 0) {
      nextId.current += 1;
      setDoodles((current) => [
        ...current,
        { id: nextId.current, points: drawing, ...pen },
      ]);
    }

    setDrawing(null);
    setAnchor(null);
  };

  const live: Doodle | null = !drawing?.length
    ? null
    : tool === "eraser"
      ? eraserStroke(drawing, pen.eraser)
      : tool
        ? {
            id: 0,
            points: drawing,
            closed: isShape(tool)
              ? shapePoints(tool, drawing[0], drawing[0]).closed
              : false,
            ...pen,
          }
        : null;

  const all = [...doodles, ...(live ? [live] : [])];
  const ink = all.filter((d) => !d.erase);
  const cuts = all.filter((d) => d.erase);

  const cursor =
    tool === "pencil"
      ? "url(/cursors/pencil.png) 2 28, crosshair"
      : tool === "eraser"
        ? "url(/cursors/eraser.png) 15 28, cell"
        : tool === "text"
          ? "text"
          : isShape(tool)
            ? shapeCursor(tool)
            : "default";

  return (
    <svg
      ref={surface}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={() => setHover(null)}
      data-draw-surface
      style={{ cursor, touchAction: "none" }}
      /*
       * The layer sits above the page furniture so you can draw over stickers
       * and over the bingo card, but below the sidebar and the panels (z-40+) —
       * otherwise it swallows their clicks and there is no way to put the tool
       * down again.
       *
       * Only the pointer events are toggled, never the depth. Dropping the
       * layer to z-0 when idle used to hide every stroke that crossed the card,
       * which is opaque and sits at z-10: you would draw on the card, put the
       * pencil down, and watch the drawing disappear. `pointer-events-none` is
       * already enough to let clicks through to what is underneath.
       */
      className={`absolute inset-0 z-[35] h-full w-full ${
        tool ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      <defs>
        {/* White shows the ink through; the eraser's black hides it. */}
        <mask id={maskId} maskUnits="userSpaceOnUse">
          <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="#fff" />
          {cuts.map((cut) =>
            renderStroke(cut, VIEW_W, VIEW_H).map((path, i) => (
              <path key={`${cut.id}-${i}`} d={path.d} fill="#000" />
            )),
          )}
        </mask>
      </defs>

      <g mask={`url(#${maskId})`}>
        {ink.map((doodle) =>
          renderStroke(doodle, VIEW_W, VIEW_H).map((path, i) => (
            <path
              key={`${doodle.id}-${i}`}
              d={path.d}
              // Outlines are filled, not stroked: that is what carries the width
              // variation the brush engine produces.
              fill={doodle.color}
              fillOpacity={path.opacity}
            />
          )),
        )}
      </g>

      {/*
        The eraser's reach, drawn where the pointer is. Resizing is invisible
        without it — you would only find out how big the eraser had become by
        rubbing something out. Sits outside the mask so it is not erased by it.
      */}
      {erasing && hover ? (
        <ellipse
          cx={hover.x * VIEW_W}
          cy={hover.y * VIEW_H}
          rx={pen.eraser / 2}
          ry={pen.eraser / 2}
          fill="none"
          stroke="#3d0e26"
          strokeOpacity={0.55}
          strokeWidth={1.5}
          strokeDasharray="6 5"
          vectorEffect="non-scaling-stroke"
          className="pointer-events-none"
        />
      ) : null}
    </svg>
  );
}
