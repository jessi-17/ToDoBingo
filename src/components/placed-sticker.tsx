"use client";

import { useRef, useState } from "react";

import Cross from "./cross";
import { ARTBOARD_HEIGHT, s, scaleVars } from "./figma-scale";

/**
 * A sticker that has been dropped onto the page.
 *
 * Position is stored as a fraction of the page box and size in artboard units,
 * so a sticker stays where it was put and keeps its relative size at every
 * viewport — the same rule the rest of the layout follows.
 */
export type Placed = {
  key: string;
  src: string;
  /** Centre of the sticker, as a fraction of the page box. */
  xPct: number;
  yPct: number;
  /** Longest edge, in artboard units. */
  size: number;
  /** Natural width / height. */
  aspect: number;
  /** Degrees clockwise. */
  rotation: number;
};

/** Every sticker lands at this size regardless of its source dimensions. */
export const DEFAULT_SIZE = 110;
const MIN_SIZE = 40;
const MAX_SIZE = 620;

export default function PlacedSticker({
  sticker,
  selected,
  onSelect,
  onChange,
  onRemove,
}: {
  sticker: Placed;
  selected: boolean;
  onSelect: () => void;
  onChange: (next: Placed) => void;
  onRemove: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<
    "idle" | "moving" | "resizing" | "rotating"
  >("idle");
  /** Captured on pointerdown; deriving these per-move races React state. */
  const grab = useRef({
    px: 0,
    py: 0,
    xPct: 0,
    yPct: 0,
    size: 0,
    boxW: 1,
    boxH: 1,
    unit: 1,
    dist: 1,
    angle: 0,
    rotation: 0,
  });

  const measure = (event: React.PointerEvent) => {
    const box = (
      root.current?.offsetParent as HTMLElement | null
    )?.getBoundingClientRect();
    if (!box) return null;

    const centreX = box.left + sticker.xPct * box.width;
    const centreY = box.top + sticker.yPct * box.height;

    grab.current = {
      px: event.clientX,
      py: event.clientY,
      xPct: sticker.xPct,
      yPct: sticker.yPct,
      size: sticker.size,
      boxW: box.width,
      boxH: box.height,
      // One artboard unit in real pixels.
      unit: box.height / ARTBOARD_HEIGHT,
      dist:
        Math.hypot(event.clientX - centreX, event.clientY - centreY) || 1,
      angle: Math.atan2(event.clientY - centreY, event.clientX - centreX),
      rotation: sticker.rotation,
    };
    return grab.current;
  };

  const startMove = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onSelect();
    if (!measure(event)) return;
    setMode("moving");
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const startResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!measure(event)) return;
    setMode("resizing");
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const startRotate = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!measure(event)) return;
    setMode("rotating");
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onMove = (event: React.PointerEvent) => {
    if (mode === "idle") return;
    event.stopPropagation();
    const g = grab.current;

    if (mode === "moving") {
      onChange({
        ...sticker,
        xPct: g.xPct + (event.clientX - g.px) / g.boxW,
        yPct: g.yPct + (event.clientY - g.py) / g.boxH,
      });
      return;
    }

    const box = (
      root.current?.offsetParent as HTMLElement | null
    )?.getBoundingClientRect();
    if (!box) return;
    const centreX = box.left + g.xPct * g.boxW;
    const centreY = box.top + g.yPct * g.boxH;

    if (mode === "rotating") {
      // Angle swept around the centre since the grab, so the sticker follows
      // the pointer rather than snapping its corner to it.
      const angle = Math.atan2(event.clientY - centreY, event.clientX - centreX);
      const degrees = ((angle - g.angle) * 180) / Math.PI;
      onChange({ ...sticker, rotation: g.rotation + degrees });
      return;
    }

    // Resize by how much further the pointer is from the sticker's centre than
    // where it started — a corner handle reads as "pull it bigger".
    const distance = Math.hypot(
      event.clientX - centreX,
      event.clientY - centreY,
    );
    const next = (g.size * distance) / g.dist;
    onChange({
      ...sticker,
      size: Math.min(Math.max(next, MIN_SIZE), MAX_SIZE),
    });
  };

  const endGesture = (event: React.PointerEvent) => {
    if (mode === "idle") return;
    event.stopPropagation();
    (event.currentTarget as HTMLElement).releasePointerCapture(
      event.pointerId,
    );
    setMode("idle");
  };

  // Longest edge is `size`, so every sticker occupies the same visual footprint
  // whatever its source aspect.
  const width = sticker.aspect >= 1 ? sticker.size : sticker.size * sticker.aspect;
  const height = sticker.aspect >= 1 ? sticker.size / sticker.aspect : sticker.size;

  return (
    <div
      ref={root}
      onPointerDown={startMove}
      onPointerMove={onMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      style={{
        ...scaleVars,
        left: `${sticker.xPct * 100}%`,
        top: `${sticker.yPct * 100}%`,
        width: s(width),
        height: s(height),
        // Standalone `rotate`, so it composes with the `translate` that
        // Tailwind's -translate-*-1/2 centring emits rather than replacing it.
        rotate: `${sticker.rotation}deg`,
        touchAction: "none",
      }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 ${
        selected ? "z-30" : "z-20"
      } ${mode === "moving" ? "cursor-grabbing" : "cursor-grab"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sticker.src}
        alt=""
        draggable={false}
        className="pointer-events-none h-full w-full object-contain select-none"
      />

      {selected ? (
        <>
          <span
            style={{ outlineWidth: s(1.5), outlineOffset: s(4) }}
            className="pointer-events-none absolute inset-0 rounded-[2px] outline-dashed outline-[#3d0e26]/45"
          />

          <button
            type="button"
            aria-label="Resize sticker"
            onPointerDown={startResize}
            onPointerMove={onMove}
            onPointerUp={endGesture}
            onPointerCancel={endGesture}
            style={{
              width: s(16),
              height: s(16),
              right: s(-10),
              bottom: s(-10),
              borderWidth: s(1.5),
              touchAction: "none",
            }}
            className="absolute cursor-nwse-resize rounded-full border-[#3d0e26] bg-[#fff68d] transition-transform hover:scale-110"
          />

          <button
            type="button"
            aria-label="Rotate sticker"
            onPointerDown={startRotate}
            onPointerMove={onMove}
            onPointerUp={endGesture}
            onPointerCancel={endGesture}
            style={{
              width: s(16),
              height: s(16),
              right: s(-10),
              top: s(-10),
              borderWidth: s(1.5),
              touchAction: "none",
            }}
            className="absolute flex cursor-grab items-center justify-center rounded-full border-[#3d0e26] bg-[#93d1fc] transition-transform hover:scale-110 active:cursor-grabbing"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-2/3 w-2/3">
              <path
                d="M12.5 6.4A5 5 0 1 0 13 9"
                stroke="#3d0e26"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M12.9 3v3.6H9.4"
                stroke="#3d0e26"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            type="button"
            aria-label="Remove sticker"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
            style={{
              width: s(18),
              height: s(18),
              left: s(-12),
              top: s(-12),
            }}
            className="absolute flex cursor-pointer items-center justify-center rounded-full bg-white/85 transition-transform hover:scale-110"
          >
            <Cross size={11} />
          </button>
        </>
      ) : null}
    </div>
  );
}
