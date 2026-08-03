"use client";

import { useSyncExternalStore } from "react";

import { s, scaleVars } from "./figma-scale";
import { STAR_SHAPES } from "./star-shapes";

/**
 * Sparkles scattered loose across the paper, in a fresh arrangement on every
 * visit.
 *
 * The layout is generated after mount rather than during render: randomising
 * while rendering would make the server and client disagree and blow up
 * hydration. Nothing paints on the first frame, which is the right trade for
 * decoration.
 */
type Star = {
  key: number;
  shape: (typeof STAR_SHAPES)[number];
  left: number;
  top: number;
  size: number;
  tilt: number;
  period: number;
  delay: number;
};

/**
 * One star per grid cell, jittered inside it. Placing them by pure random
 * coordinates clumps some corners and leaves others bare — the eye reads that
 * as a mistake rather than as scatter. A jittered grid keeps the spread even
 * while staying irregular enough not to look like a grid.
 */
const COLS = 6;
const ROWS = 3;

/**
 * Kept inside the paper and clear of the binding, the bottom frame, and the
 * sidebar — a star behind the translucent rail shows through it oddly.
 */
const AREA = { left: 13, right: 96, top: 17, bottom: 87 };
/** Fraction of a cell left empty at its edges, so neighbours stay apart. */
const INSET = 0.16;

const scatter = (): Star[] => {
  const cellW = (AREA.right - AREA.left) / COLS;
  const cellH = (AREA.bottom - AREA.top) / ROWS;

  // Deal the colours out and shuffle, so every shape appears about as often
  // instead of one happening to dominate the page.
  const palette = Array.from(
    { length: COLS * ROWS },
    (_, i) => STAR_SHAPES[i % STAR_SHAPES.length],
  );
  for (let i = palette.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [palette[i], palette[j]] = [palette[j], palette[i]];
  }

  return palette.map((shape, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const jitter = () => INSET + Math.random() * (1 - INSET * 2);

    return {
      key: i,
      shape,
      left: AREA.left + (col + jitter()) * cellW,
      top: AREA.top + (row + jitter()) * cellH,
      size: 22 + Math.random() * 28,
      tilt: Math.random() * 40 - 20,
      // Each on its own clock, so the set never jiggles in unison.
      period: 1.1 + Math.random() * 1.1,
      delay: -Math.random() * 2,
    };
  });
};

const NONE: Star[] = [];
/** Generated once per page load, so a reload gives a new arrangement. */
let layout: Star[] | null = null;

const subscribe = () => () => {};
const getSnapshot = () => (layout ??= scatter());
const getServerSnapshot = () => NONE;

export default function PageStars() {
  // Read through useSyncExternalStore rather than randomising in render: the
  // server and client would otherwise disagree and break hydration. The server
  // snapshot is empty and the real layout appears on the client.
  const stars = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      {stars.map((star) => (
        // Resting tilt and the jiggle live on separate elements: the animation
        // drives `rotate`, and an animated property overrides the inline one,
        // so on a single element every star would snap to the same angle.
        <span
          key={star.key}
          style={{
            ...scaleVars,
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: s(star.size),
            height: s(star.size),
            rotate: `${star.tilt}deg`,
          }}
          className="absolute block"
        >
          <span
            style={{
              ["--jiggle" as string]: `${star.period}s`,
              ["--jiggle-delay" as string]: `${star.delay}s`,
            }}
            className="star-jiggle block h-full w-full"
          >
            <svg
              viewBox={star.shape.viewBox}
              fill="none"
              className="h-full w-full"
            >
              <path d={star.shape.fill} fill={star.shape.fillColor} />
              <path
                d={star.shape.outline}
                stroke={star.shape.stroke}
                strokeWidth={star.shape.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </span>
      ))}
    </div>
  );
}
