"use client";

import { useState } from "react";

import { panelClass, panelStyle, s } from "./figma-scale";

/**
 * A colour picker in the app's own skin.
 *
 * `<input type="color">` opens the operating system's picker, which looks like
 * neither the page nor the rest of this UI and cannot be styled at all. This is
 * the same saturation square and hue slider, drawn as part of the panel.
 */
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const hexToRgb = (hex: string) => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const value = match ? parseInt(match[1], 16) : 0;
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
};

export const hexToHsv = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const delta = max - min;

  let h = 0;
  if (delta) {
    if (max === R) h = ((G - B) / delta) % 6;
    else if (max === G) h = (B - R) / delta + 2;
    else h = (R - G) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? delta / max : 0, v: max };
};

export const hsvToHex = (h: number, s: number, v: number) => {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const rgb: [number, number, number] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];

  const channel = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(rgb[0])}${channel(rgb[1])}${channel(rgb[2])}`;
};

export default function ColorPicker({
  value,
  onChange,
  onClose,
  className = "",
}: {
  value: string;
  onChange: (hex: string) => void;
  onClose: () => void;
  className?: string;
}) {
  const hsv = hexToHsv(value);
  // Hue is kept locally: at pure black or white the hex carries no hue, so
  // reading it back would snap the slider to red every time.
  const [hue, setHue] = useState(hsv.h);

  /**
   * Geometry comes from `event.currentTarget` rather than a ref. The element
   * handling the pointer is the element being measured, so a ref would add
   * nothing — and reading one from a handler built during render is exactly
   * what the refs lint rule warns about.
   */
  const pickSV = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    onChange(
      hsvToHex(
        hue,
        clamp01((event.clientX - box.left) / box.width),
        1 - clamp01((event.clientY - box.top) / box.height),
      ),
    );
  };

  const pickHue = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const next = clamp01((event.clientX - box.left) / box.width) * 360;
    setHue(next);
    onChange(hsvToHex(next, hsv.s || 1, hsv.v || 1));
  };

  return (
    <div
      data-picker
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        ...panelStyle,
        width: s(320),
        borderRadius: s(14),
        padding: s(16),
        rowGap: s(12),
        touchAction: "none",
      }}
      className={`flex flex-col ${panelClass} ${className}`}
    >
      {/* Saturation across, brightness down */}
      <div
        onPointerDown={(event) => {
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          pickSV(event);
        }}
        onPointerMove={(event) => {
          if (event.buttons !== 1) return;
          event.stopPropagation();
          pickSV(event);
        }}
        style={{
          height: s(168),
          borderRadius: s(8),
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue} 100% 50%))`,
        }}
        className="relative cursor-crosshair"
      >
        <span
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            width: s(18),
            height: s(18),
            borderWidth: s(2.5),
          }}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-white shadow"
        />
      </div>

      {/* Hue */}
      <div
        onPointerDown={(event) => {
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          pickHue(event);
        }}
        onPointerMove={(event) => {
          if (event.buttons !== 1) return;
          event.stopPropagation();
          pickHue(event);
        }}
        style={{
          height: s(22),
          borderRadius: s(999),
          background:
            "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
        }}
        className="relative cursor-pointer"
      >
        <span
          style={{
            left: `${(hue / 360) * 100}%`,
            width: s(22),
            height: s(22),
            borderWidth: s(2.5),
            backgroundColor: hsvToHex(hue, 1, 1),
          }}
          className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-white shadow"
        />
      </div>

      <div style={{ columnGap: s(8) }} className="flex items-center">
        <span
          style={{
            width: s(34),
            height: s(34),
            borderRadius: s(4),
            backgroundColor: value,
            borderWidth: s(1),
          }}
          className="shrink-0 border-black/25"
        />
        <span
          style={{ fontSize: s(16) }}
          className="uppercase tracking-wide text-black/70"
        >
          {value}
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            marginLeft: "auto",
            height: s(32),
            paddingInline: s(16),
            borderRadius: s(8),
            fontSize: s(14),
            borderWidth: s(1.5),
          }}
          className="cursor-pointer border-[#9d3124] bg-[#fff68d] text-[#3d0e26] transition-transform hover:scale-105 active:scale-95"
        >
          Done
        </button>
      </div>
    </div>
  );
}
