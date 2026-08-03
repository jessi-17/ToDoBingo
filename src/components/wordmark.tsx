"use client";

import Image from "next/image";
import { useState } from "react";

import lettering from "../../public/icons/todolist-lettering.svg";
import { s, scaleVars } from "./figma-scale";
import { sfx } from "./sounds";
import { STAR_PATHS } from "./wordmark-star-paths";

/**
 * The "To Do Bingo" wordmark, with its two sparkles made clickable.
 *
 * The lettering stays a static SVG asset and the stars are inlined, because
 * only the stars need to be addressable — the letterforms are 206 KB of path
 * data that would otherwise ride along in the JS bundle for no reason.
 *
 * The star overlay uses the wordmark's own viewBox, so the paths land back
 * exactly where they were lifted from with no positioning maths.
 */
type StarName = keyof typeof STAR_PATHS;

type Star = {
  fill: string;
  outline: string;
  fillColor: string;
  stroke: string;
  strokeWidth: number;
  /** Placement into the wordmark viewBox, for stars from a separate file. */
  transform?: string;
};

/** Each sparkle drifts on its own clock so the set never moves as one. */
const IDLE_CLASS: Record<StarName, string> = {
  blue: "",
  pink: "star-idle-slow",
  green: "star-idle-alt",
};

export default function Wordmark({
  className = "",
  mobile = false,
}: {
  className?: string;
  /** On portrait, sized from the width — the height-derived scale runs wide. */
  mobile?: boolean;
}) {
  // Derived from the star list rather than written out, so adding another
  // sparkle needs no change here.
  const [spin, setSpin] = useState<Record<StarName, number>>(
    () =>
      Object.fromEntries(
        (Object.keys(STAR_PATHS) as StarName[]).map((name) => [name, 0]),
      ) as Record<StarName, number>,
  );

  const spinStar = (name: StarName) => {
    // The glitter cling — the sparkles are the page's little instrument.
    sfx.sparkle(3);
    setSpin((current) => ({ ...current, [name]: current[name] + 180 }));
  };

  return (
    <div
      style={{
        ...(mobile
          ? ({ "--s": "calc(62cqw / 514)" } as React.CSSProperties)
          : scaleVars),
        width: s(514),
        height: s(170),
      }}
      className={`absolute select-none ${className}`}
    >
      <Image
        src={lettering}
        alt="To Do Bingo"
        priority
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      <svg
        viewBox="0 0 515 171"
        fill="none"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      >
        {(Object.keys(STAR_PATHS) as StarName[]).map((name) => {
          const star: Star = STAR_PATHS[name];

          return (
            // Outer group places stars that came from their own file. It uses
            // the transform attribute, which the CSS transform below would
            // otherwise overwrite — they are the same property.
            <g key={name} transform={star.transform}>
              <g
                role="button"
                tabIndex={0}
                aria-label={`Spin the ${name} star`}
                onClick={() => spinStar(name)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    spinStar(name);
                  }
                }}
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  transform: `rotate(${spin[name]}deg)`,
                  // Overshoots on settle so it lands with a bounce rather than
                  // easing flatly to a stop.
                  transition:
                    "transform 700ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
                // Tailwind v4 emits the standalone `scale` property, which
                // composes with the `transform` rotate above instead of
                // clobbering it.
                className="pointer-events-auto cursor-pointer outline-none hover:scale-110"
              >
                {/* Inner group carries the never-ending drift, so it cannot
                    collide with the spin transform on the parent. */}
                <g className={`star-idle ${IDLE_CLASS[name]}`}>
                  <path d={star.fill} fill={star.fillColor} />
                  <path
                    d={star.outline}
                    stroke={star.stroke}
                    strokeWidth={star.strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
