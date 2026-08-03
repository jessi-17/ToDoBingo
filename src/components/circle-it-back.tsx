"use client";

import { useRef, useState } from "react";

import Cross from "./cross";
import { bodyFont, s, scaleVars } from "./figma-scale";
import { sfx } from "./sounds";
import { type Task } from "./tasks";

/**
 * "Circle it back" — the retro CD from Figma node 261:872.
 *
 * There is no panel behind it and no tint over it: the bare disc art carries
 * the colour, and the tasks are labels laid around it, one per slot. The hub is
 * the green "SPIN IT" sticker frame (node 261:894) and stays put while the disc
 * turns beneath it.
 *
 * The landing is not left to chance: a winner is chosen first, then the exact
 * rotation that parks that wedge under the needle is computed. Spinning by a
 * random amount and reading off the result instead would sometimes stop with
 * the needle straddling a boundary, which looks broken however you round it.
 */
const VIEW = 200;
const C = VIEW / 2;
const R_OUTER = 99;
const R_LABEL = 0.573 * R_OUTER;
/**
 * Where the glass overlay starts, measured off the disc art rather than taken
 * from Figma. A radial scan puts the black ring at 0.28–0.34 of the radius and
 * the rainbow from 0.36. Figma's 0.2848 is the *hub's* footprint, so an overlay
 * starting there covers the black ring; 0.375 leaves it bare and begins the
 * glass on the CD proper.
 */
const R_INNER = 0.375 * R_OUTER;

/** Annular wedge `index` of `count`, starting at 12 o'clock, running clockwise. */
const wedgePath = (index: number, count: number) => {
  const slot = 360 / count;
  // Figma leaves ~18% of each slot open so the disc shows between wedges.
  const span = slot * 0.82;
  const from = index * slot - 90 + (slot - span) / 2;
  const to = from + span;
  const large = span > 180 ? 1 : 0;
  const [x0, y0] = point(R_INNER, from);
  const [x1, y1] = point(R_OUTER, from);
  const [x2, y2] = point(R_OUTER, to);
  const [x3, y3] = point(R_INNER, to);

  return [
    `M ${x0} ${y0}`,
    `L ${x1} ${y1}`,
    `A ${R_OUTER} ${R_OUTER} 0 ${large} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${R_INNER} ${R_INNER} 0 ${large} 0 ${x0} ${y0}`,
    "Z",
  ].join(" ");
};

/**
 * Artboard units. Sized against the notepad rather than the window, so it
 * stays proportionally large at any screen size. 700 fills the right-hand slot
 * the bingo card vacates — the two share that space and swap in and out of it.
 */
const DISC = 700;
/** Hub is 213 across a 736 disc in Figma. */
const HUB = 0.289 * DISC;
const TURNS = 4;
const SPIN_MS = 4200;
const SPIN_EASE = "cubic-bezier(0.12, 0.72, 0.06, 1)";

/** Wedge fills and label inks, taken from the Figma disc. */
const WEDGE_STYLES = [
  { fill: "#fff68d", ink: "#5e6f10" },
  { fill: "#9d3124", ink: "#fff68d" },
  { fill: "#7b9115", ink: "#fff68d" },
  { fill: "#f6aff2", ink: "#a4026a" },
];

/** The "SPIN IT" beads and charms, laid out in the hub's own 213x207 space. */
const HUB_W = 213;
const HUB_H = 207;
const HUB_ITEMS = [
  { src: "/stickers/image-54.webp", x: 42, y: 27, w: 32, h: 32 },
  { src: "/stickers/image-64.webp", x: 146, y: 33, w: 42, h: 37 },
  { src: "/stickers/image-58.webp", x: 6, y: 97, w: 73, h: 66 },
  { src: "/stickers/image-55.webp", x: 144, y: 110, w: 45, h: 40 },
  { src: "/stickers/image-87.webp", x: 36, y: 68, w: 35, h: 35 }, // S
  { src: "/stickers/image-84.webp", x: 69, y: 63, w: 40, h: 40 }, // P
  { src: "/stickers/image-77.webp", x: 105, y: 66, w: 40, h: 40 }, // I
  { src: "/stickers/image-82.webp", x: 141, y: 64, w: 39, h: 39 }, // N
  { src: "/stickers/image-77.webp", x: 72, y: 107, w: 38, h: 38 }, // I
  { src: "/stickers/image-88.webp", x: 102, y: 101, w: 41, h: 44 }, // T
];

/**
 * A short rising arpeggio for the landing. Synthesised rather than loaded from
 * a file so it costs nothing to ship, and it only ever fires off the back of a
 * click, which keeps browser autoplay policies happy.
 */
const playChime = () => {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;

    const ctx = new Ctor();
    const start = ctx.currentTime;

    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) => {
      const at = start + i * 0.085;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.16, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.65);
    });

    setTimeout(() => void ctx.close(), 1600);
  } catch {
    // Audio is a garnish; never let it break the spin.
  }
};

const point = (radius: number, degrees: number) => {
  const radians = (degrees * Math.PI) / 180;
  return [C + radius * Math.cos(radians), C + radius * Math.sin(radians)];
};

export default function CircleItBack({
  tasks,
  onClose,
  onPriority,
  mobile = false,
}: {
  tasks: Task[];
  onClose: () => void;
  onPriority: (task: Task) => void;
  /** Centred near the top on the portrait layout, sized by width. */
  mobile?: boolean;
}) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- drag the disc around the page ---------------------------------------
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [moving, setMoving] = useState(false);
  const origin = useRef({ px: 0, py: 0, ox: 0, oy: 0 });

  const startDrag = (event: React.PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    origin.current = {
      px: event.clientX,
      py: event.clientY,
      ox: offset.x,
      oy: offset.y,
    };
    setMoving(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onDrag = (event: React.PointerEvent) => {
    if (!moving) return;
    const { px, py, ox, oy } = origin.current;
    setOffset({ x: ox + (event.clientX - px), y: oy + (event.clientY - py) });
  };

  const endDrag = (event: React.PointerEvent<HTMLElement>) => {
    setMoving(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  // --- the spin ------------------------------------------------------------
  const spin = () => {
    if (spinning || tasks.length === 0) return;
    sfx.whirr();

    const slot = 360 / tasks.length;
    const target = Math.floor(Math.random() * tasks.length);
    // Park the middle of the winning wedge under the needle at 12 o'clock.
    const wanted = -(target * slot + slot / 2);
    const delta = (((wanted - rotation) % 360) + 360) % 360;

    setSpinning(true);
    setRotation(rotation + TURNS * 360 + delta);

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      playChime();
      onPriority(tasks[target]);
      setSpinning(false);
    }, SPIN_MS);
  };

  const spinTransition = spinning
    ? `rotate ${SPIN_MS}ms ${SPIN_EASE}`
    : undefined;

  if (tasks.length === 0) {
    return (
      <div
        style={{
          ...scaleVars,
          fontFamily: bodyFont,
          fontSize: s(18),
          lineHeight: s(26),
        }}
        className={`absolute z-45 text-black/70 ${
          mobile
            ? "left-1/2 top-[20%] -translate-x-1/2 text-center"
            : "left-[63%] top-1/2 -translate-y-1/2"
        }`}
      >
        No tasks yet — add some in the to-do list
        <br />
        and the disc will carve itself up for them.
        <button
          type="button"
          onClick={onClose}
          aria-label="Close circle it back"
          style={{ marginTop: s(16) }}
          className="mx-auto flex cursor-pointer items-center justify-center"
        >
          <Cross size={22} />
        </button>
      </div>
    );
  }

  return (
    <div
      aria-label="Circle it back"
      onPointerDown={startDrag}
      onPointerMove={onDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{
        ...(mobile
          ? ({
              "--s": `min(calc(92cqw / ${DISC}), calc(58cqh / ${DISC}))`,
            } as React.CSSProperties)
          : scaleVars),
        width: s(DISC),
        height: s(DISC),
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        touchAction: "none",
      }}
      className={`absolute z-45 ${
        mobile
          ? "left-1/2 top-[12%] -translate-x-1/2"
          : "left-[63%] top-1/2 -translate-y-1/2"
      } ${moving ? "cursor-grabbing" : "cursor-grab"}`}
    >
      {/* Everything that turns */}
      <div
        style={{ rotate: `${rotation}deg`, transition: spinTransition }}
        className="absolute inset-0"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/cd/disc.webp"
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-contain drop-shadow-xl"
        />

        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="absolute inset-0 h-full w-full"
        >
          {tasks.map((task, index) => {
            const style = WEDGE_STYLES[index % WEDGE_STYLES.length];
            const slot = 360 / tasks.length;
            const mid = (index + 0.5) * slot - 90;
            const [lx, ly] = point(R_LABEL, mid);

            return (
              <g key={task.id}>
                <path
                  d={wedgePath(index, tasks.length)}
                  fill={style.fill}
                  opacity={0.5}
                />
                {/*
                  The label rides the turning disc but counter-rotates by the
                  same amount, so it orbits while staying upright. Both animate
                  on the same clock, which is why they stay in step through the
                  spin. Orienting labels per wedge instead only works on a disc
                  that never moves — once it turns, half read backwards.
                */}
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={style.ink}
                  style={{
                    rotate: `${-rotation}deg`,
                    transformBox: "fill-box",
                    transformOrigin: "center",
                    transition: spinTransition,
                    fontSize: Math.max(5, Math.min(9, 40 / tasks.length)),
                    fontWeight: 700,
                    fontFamily: bodyFont,
                    paintOrder: "stroke fill",
                    stroke: "rgba(0,0,0,0.35)",
                    strokeWidth: 0.7,
                  }}
                >
                  {task.label.length > 12
                    ? `${task.label.slice(0, 11)}…`
                    : task.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Needle, fixed at 12 o'clock */}
      <div
        style={{
          top: s(-10),
          borderLeftWidth: s(15),
          borderRightWidth: s(15),
          borderTopWidth: s(30),
        }}
        className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 border-x-transparent border-t-[#9d3124] drop-shadow"
      />

      {/* The green glass hub — press it to spin. Frosts the disc beneath. */}
      <button
        type="button"
        onClick={spin}
        disabled={spinning}
        aria-label={spinning ? "Spinning" : "Spin the disc"}
        style={{
          width: s(HUB),
          height: s(HUB),
          backgroundColor: "rgba(223, 243, 128, 0.82)",
          backdropFilter: "blur(6px) saturate(150%)",
          WebkitBackdropFilter: "blur(6px) saturate(150%)",
          boxShadow: `inset 0 ${s(-3)} ${s(6)} rgba(0,0,0,0.14), inset 0 ${s(3)} ${s(6)} rgba(0,0,0,0.12)`,
        }}
        className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full transition-transform hover:scale-105 active:scale-95 disabled:cursor-default"
      >
        <span className="relative block h-full w-full">
          {HUB_ITEMS.map((item, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={index}
              src={item.src}
              alt=""
              draggable={false}
              style={{
                left: `${(item.x / HUB_W) * 100}%`,
                top: `${(item.y / HUB_H) * 100}%`,
                width: `${(item.w / HUB_W) * 100}%`,
                height: `${(item.h / HUB_H) * 100}%`,
              }}
              className="pointer-events-none absolute max-w-none object-contain"
            />
          ))}
        </span>
      </button>

      {/* Close, tucked against the disc's top-right */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close circle it back"
        style={{ width: s(40), height: s(40), right: s(-4), top: s(6) }}
        className="absolute z-30 flex cursor-pointer items-center justify-center rounded-full bg-white/70 transition-transform hover:scale-110 active:scale-95"
      >
        <Cross size={22} />
      </button>

    </div>
  );
}
