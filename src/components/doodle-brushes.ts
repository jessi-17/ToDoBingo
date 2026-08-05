import { getStroke } from "perfect-freehand";

/**
 * Brush engine for the Doodles tool, built on perfect-freehand.
 *
 * Strokes are filled outlines rather than stroked centre lines, which is what
 * gives them real weight variation and tapered ends — a plain `stroke-width`
 * line is the same thickness end to end and always reads as a mouse trail.
 *
 * Points are stored as fractions of the page, never as path strings, so a
 * drawing survives a resize and can be re-rendered under a different brush.
 */
export type Point = { x: number; y: number };

export type BrushId =
  | "heist"
  | "blockbuster"
  | "grindhouse"
  | "biopic"
  | "spaghetti";

export type StrokeStyle = "solid" | "dashed" | "dotted";

/** Shapes are drawn through the same brushes, so they carry the same texture. */
export type ShapeId =
  | "line"
  | "rect"
  | "ellipse"
  | "triangle"
  | "arrow"
  | "star";

/**
 * Glyphs for each tool, shared by the panel buttons and the drawing cursor —
 * the pointer has to show which shape is armed, and it should be the same mark
 * the button shows.
 */
export const TOOL_ICONS: Record<ShapeId | "pencil", string> = {
  pencil: "M3 17 L10 4 L13 7 L6 20 Z",
  line: "M4 19 L20 5",
  rect: "M4 5 H20 V19 H4 Z",
  ellipse: "M12 4 A8 7.5 0 1 1 11.9 4 Z",
  triangle: "M12 4 L21 19 H3 Z",
  arrow: "M3 20 L20 5 M20 5 H13 M20 5 V12",
  star: "M12 3 L14.6 9.5 L21.5 9.9 L16.2 14.3 L18 21 L12 17.2 L6 21 L7.8 14.3 L2.5 9.9 L9.4 9.5 Z",
};

export const TOOL_LABELS: Record<ShapeId | "pencil", string> = {
  pencil: "Freehand",
  line: "Line",
  rect: "Square",
  ellipse: "Circle",
  triangle: "Triangle",
  arrow: "Arrow",
  star: "Star",
};

export type Doodle = {
  id: number;
  points: Point[];
  color: string;
  opacity: number;
  /** Artboard units. */
  width: number;
  brush: BrushId;
  style: StrokeStyle;
  /** Closed shapes join back to their first point. */
  closed?: boolean;
  /**
   * An eraser pass rather than ink. Stored in the same list so it keeps its
   * place in the stack — erasing only affects what was already underneath it.
   */
  erase?: boolean;
  /** Width/height of the page this was drawn on — see `atAspect`. */
  aspect?: number;
};

/**
 * Re-fits a stroke to the page shape it is being viewed on.
 *
 * Points are fractions of the page, so a page that changes shape stretches
 * the drawing with it: a circle drawn on a phone came back as a wide ellipse
 * in a desktop window. Each stroke records the aspect it was drawn at; viewed
 * at any other, its x coordinates are corrected around the page's centre so
 * the drawn shape survives. Everything drawn at the same aspect shares one
 * correction, which keeps eraser cuts aligned with the ink they erased.
 * Strokes from before this field existed render as they always did.
 */
export const atAspect = (doodle: Doodle, aspect: number): Doodle => {
  if (!doodle.aspect || !aspect || Math.abs(doodle.aspect - aspect) < 0.005) {
    return doodle;
  }
  const k = doodle.aspect / aspect;
  return {
    ...doodle,
    points: doodle.points.map((p) => ({ ...p, x: 0.5 + (p.x - 0.5) * k })),
  };
};

type Spec = {
  id: BrushId;
  label: string;
  /** How hard width reacts to pressure: the brush's whole personality. */
  thinning: number;
  smoothing: number;
  streamline: number;
  taperStart: number;
  taperEnd: number;
  /**
   * Pressure along the stroke, 0–1, from position rather than speed.
   *
   * `simulatePressure` derives pressure from how far apart the points are, so
   * an evenly-spaced run — every preview, every shape, any steady hand — comes
   * out a uniform width and every brush ends up looking identical. Driving it
   * from position instead gives each brush a profile you can actually see.
   */
  pressure: (t: number) => number;
  /** Extra passes, offset by a multiple of the stroke width. */
  passes?: number;
  scatter?: number;
  passScale?: number;
  passOpacity?: number;
};

const bell = (t: number, power = 1) => Math.sin(Math.PI * t) ** power;

export const BRUSH_SPECS: Record<BrushId, Spec> = {
  // Flat and even, like a chisel marker. The control against the others.
  blockbuster: {
    id: "blockbuster",
    label: "Blockbuster",
    thinning: 0,
    smoothing: 0.7,
    streamline: 0.6,
    taperStart: 0,
    taperEnd: 0,
    pressure: () => 1,
  },
  // Inked: bites in, swells, and lifts off to a point.
  heist: {
    id: "heist",
    label: "Heist",
    thinning: 0.72,
    smoothing: 0.45,
    streamline: 0.4,
    taperStart: 6,
    taperEnd: 40,
    pressure: (t) => 0.25 + 0.75 * bell(t, 0.45),
  },
  // Dry and broken up: several thin passes scattered off the centre line.
  grindhouse: {
    id: "grindhouse",
    label: "Grindhouse",
    thinning: 0.55,
    smoothing: 0.12,
    streamline: 0.12,
    taperStart: 4,
    taperEnd: 8,
    pressure: (t) => 0.45 + 0.4 * Math.abs(Math.sin(t * 21)),
    passes: 3,
    scatter: 0.42,
    passScale: 0.5,
    passOpacity: 0.6,
  },
  // Brush-pen drama: hairline in, very heavy through the middle, hairline out.
  biopic: {
    id: "biopic",
    label: "Biopic",
    thinning: 0.95,
    smoothing: 0.85,
    streamline: 0.72,
    taperStart: 2,
    taperEnd: 2,
    pressure: (t) => 0.04 + 0.96 * bell(t, 0.35),
    passScale: 1,
  },
  // Fine hatching: four hairlines running alongside each other.
  spaghetti: {
    id: "spaghetti",
    label: "Spaghetti Western",
    thinning: 0.25,
    smoothing: 0.55,
    streamline: 0.5,
    taperStart: 20,
    taperEnd: 26,
    pressure: (t) => 0.5 + 0.3 * Math.sin(t * 7),
    passes: 3,
    scatter: 0.85,
    passScale: 0.34,
    passOpacity: 1,
  },
};

export const BRUSHES = Object.values(BRUSH_SPECS);

/** Deterministic offset, so a stroke redraws identically every render. */
const wobble = (seed: number) => {
  const v = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
};

const toPath = (outline: number[][]) => {
  if (!outline.length) return "";
  const d = outline.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...outline[0], "Q"] as (string | number)[],
  );
  return `${d.join(" ")} Z`;
};

const cumulative = (pts: number[][]) => {
  const lengths = [0];
  for (let i = 1; i < pts.length; i++) {
    lengths.push(
      lengths[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]),
    );
  }
  return lengths;
};

/** Chops a point run into dash segments, so dashes keep the brush texture. */
const dashRuns = (pts: number[][], on: number, off: number) => {
  if (pts.length < 2) return [pts];
  const lengths = cumulative(pts);
  const total = lengths.at(-1) ?? 0;
  const runs: number[][][] = [];
  const period = on + off;

  for (let start = 0; start < total; start += period) {
    const stop = Math.min(start + on, total);
    const run = pts.filter((_, i) => lengths[i] >= start && lengths[i] <= stop);
    if (run.length >= 2) runs.push(run);
    else if (run.length === 1) runs.push([run[0], [run[0][0] + 0.01, run[0][1]]]);
  }
  return runs;
};

export type RenderedPath = { d: string; opacity: number };

/**
 * Turns a stroke into the filled outlines that draw it. The two scales convert
 * page fractions into the space being rendered into; they differ because the
 * page is wider than it is tall, and a single scale would stretch the geometry.
 */
export const renderStroke = (
  doodle: Doodle,
  scaleX: number,
  scaleY: number = scaleX,
): RenderedPath[] => {
  const spec = BRUSH_SPECS[doodle.brush];
  let pts = doodle.points.map((p) => [p.x * scaleX, p.y * scaleY]);
  if (doodle.closed && pts.length > 2) pts = [...pts, pts[0]];
  if (!pts.length) return [];

  const size = doodle.width;
  const runs =
    doodle.style === "solid"
      ? [pts]
      : dashRuns(
          pts,
          doodle.style === "dashed" ? size * 2.6 : size * 0.45,
          size * 1.9,
        );

  const outlineFor = (run: number[][], sizeScale: number, seed: number) => {
    // Scatter is a multiple of the stroke width, not an absolute distance, so a
    // brush looks the same in a 100-unit preview as at 1000-unit page scale.
    const spread = (spec.scatter ?? 0) * size;
    const withPressure = run.map((p, i) => {
      const t = run.length > 1 ? i / (run.length - 1) : 0.5;
      const offset = seed ? spread : 0;
      return [
        p[0] + wobble(i * 1.7 + seed) * offset,
        p[1] + wobble(i * 2.9 + seed * 3) * offset,
        spec.pressure(t),
      ];
    });

    return toPath(
      getStroke(withPressure, {
        size: size * sizeScale,
        thinning: spec.thinning,
        smoothing: spec.smoothing,
        streamline: spec.streamline,
        // Pressure comes from the brush profile above, not from point spacing.
        simulatePressure: false,
        start: { taper: spec.taperStart, cap: true },
        end: { taper: spec.taperEnd, cap: true },
      }) as number[][],
    );
  };

  const paths: RenderedPath[] = [];
  for (const run of runs) {
    paths.push({ d: outlineFor(run, 1, 0), opacity: doodle.opacity });
    for (let n = 1; n <= (spec.passes ?? 0); n++) {
      paths.push({
        d: outlineFor(run, spec.passScale ?? 0.5, n * 7 + 3),
        opacity: doodle.opacity * (spec.passOpacity ?? 0.5),
      });
    }
  }
  return paths;
};

// --- shapes ---------------------------------------------------------------

const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/** Samples an edge so the brush has enough points to shape a stroke. */
const edge = (a: Point, b: Point, steps = 14) =>
  Array.from({ length: steps }, (_, i) => lerp(a, b, i / (steps - 1)));

/**
 * Builds a shape as a plain point run, so it flows through exactly the same
 * brush engine as a freehand stroke and picks up the same texture.
 */
export const shapePoints = (
  shape: ShapeId,
  from: Point,
  to: Point,
): { points: Point[]; closed: boolean } => {
  const left = Math.min(from.x, to.x);
  const right = Math.max(from.x, to.x);
  const top = Math.min(from.y, to.y);
  const bottom = Math.max(from.y, to.y);
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  const rx = (right - left) / 2;
  const ry = (bottom - top) / 2;

  switch (shape) {
    case "line":
      return { points: edge(from, to, 18), closed: false };

    case "rect": {
      const tl = { x: left, y: top };
      const tr = { x: right, y: top };
      const br = { x: right, y: bottom };
      const bl = { x: left, y: bottom };
      return {
        points: [...edge(tl, tr), ...edge(tr, br), ...edge(br, bl), ...edge(bl, tl)],
        closed: true,
      };
    }

    case "ellipse":
      return {
        points: Array.from({ length: 48 }, (_, i) => {
          const a = (i / 47) * Math.PI * 2 - Math.PI / 2;
          return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
        }),
        closed: true,
      };

    case "triangle": {
      const apex = { x: cx, y: top };
      const br = { x: right, y: bottom };
      const bl = { x: left, y: bottom };
      return {
        points: [...edge(apex, br), ...edge(br, bl), ...edge(bl, apex)],
        closed: true,
      };
    }

    case "arrow": {
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const head = Math.hypot(to.x - from.x, to.y - from.y) * 0.26;
      const wing = (spread: number) => ({
        x: to.x - head * Math.cos(angle - spread),
        y: to.y - head * Math.sin(angle - spread),
      });
      return {
        points: [
          ...edge(from, to, 16),
          ...edge(to, wing(0.5), 6),
          ...edge(wing(0.5), to, 6),
          ...edge(to, wing(-0.5), 6),
        ],
        closed: false,
      };
    }

    case "star": {
      const points: Point[] = [];
      for (let i = 0; i <= 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? 1 : 0.42;
        points.push({ x: cx + rx * r * Math.cos(a), y: cy + ry * r * Math.sin(a) });
      }
      const sampled: Point[] = [];
      for (let i = 0; i < points.length - 1; i++) {
        sampled.push(...edge(points[i], points[i + 1], 5));
      }
      return { points: sampled, closed: true };
    }
  }
};
