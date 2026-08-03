"use client";

import { useRef, useState } from "react";

import ColorPicker from "./color-picker";
import Cross from "./cross";
import {
  BRUSHES,
  renderStroke,
  type BrushId,
  type ShapeId,
  type StrokeStyle,
} from "./doodle-brushes";
import { type DoodleTool, type PenSettings } from "./doodle-layer";
import {
  bodyFont,
  displayFont,
  panelClass,
  panelScaleVars,
  panelStyle,
  s,
  SHEET_BOTTOM,
  sheetScaleVars,
} from "./figma-scale";
import { NOTE_FONTS } from "./note-fonts";

/**
 * The Doodles panel — everything you can put on the page by hand.
 *
 * Organised by *what you are making*, not by what settings exist. The three
 * things the panel produces are a freehand line, a shape, and a text box, and
 * they need almost disjoint controls: a brush is meaningless to text, a font is
 * meaningless to a rectangle. Presenting all of it at once as one undivided row
 * of icons meant every visit started by working out which controls applied.
 *
 * So the mode comes first and the body follows it. Only colour is shared by all
 * three, and it is the one block that stays put at the bottom.
 *
 * Field chrome follows Figma node 61:561: 40 tall, white, 1px black/10 border,
 * 8 radius, with a 0 1px 2.3px black/25 shadow.
 */
const FIELD_H = 56;
const FIELD_R = 8;
const PANEL_W = 486;

/**
 * The squiggle every brush preview is drawn with, so they can be compared.
 * Written straight in the preview's own viewBox units and rendered at scale 1 —
 * expressing it in page fractions and scaling up overflows the short preview
 * box and crops the stroke away.
 */
const PREVIEW_W = 100;
const PREVIEW_H = 30;

const SAMPLE = Array.from({ length: 34 }, (_, i) => {
  const t = i / 33;
  return {
    x: 7 + t * 86,
    y: PREVIEW_H / 2 + Math.sin(t * Math.PI * 1.9) * 8.5,
  };
});

const SWATCHES = [
  "#000000",
  "#9d3124",
  "#e50285",
  "#f6aff2",
  "#7b9115",
  "#dff380",
  "#93d1fc",
  "#fff68d",
];

const STYLES: { id: StrokeStyle; label: string }[] = [
  { id: "solid", label: "Solid" },
  { id: "dashed", label: "Dashed" },
  { id: "dotted", label: "Dotted" },
];

/** Named, because six unlabelled glyphs is exactly what was confusing. */
const SHAPES: { id: ShapeId; label: string; icon: string }[] = [
  { id: "line", label: "Line", icon: "M4 19 L20 5" },
  { id: "rect", label: "Square", icon: "M4 5 H20 V19 H4 Z" },
  { id: "ellipse", label: "Circle", icon: "M12 4 A8 7.5 0 1 1 11.9 4 Z" },
  { id: "triangle", label: "Triangle", icon: "M12 4 L21 19 H3 Z" },
  { id: "arrow", label: "Arrow", icon: "M3 20 L20 5 M20 5 H13 M20 5 V12" },
  {
    id: "star",
    label: "Star",
    icon: "M12 3 L14.6 9.5 L21.5 9.9 L16.2 14.3 L18 21 L12 17.2 L6 21 L7.8 14.3 L2.5 9.9 L9.4 9.5 Z",
  },
];

export type PanelTool = ShapeId | "pencil" | "text";
type Mode = "draw" | "shapes" | "text";

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "draw", label: "Draw", hint: "Freehand" },
  { id: "shapes", label: "Shapes", hint: "Drag one out" },
  { id: "text", label: "Text", hint: "Click to place" },
];

/** Which mode a tool belongs to, so the tabs follow the tool and not a copy. */
const modeOf = (tool: DoodleTool): Mode =>
  tool === "text" ? "text" : tool === "pencil" || !tool ? "draw" : "shapes";

const fieldStyle = {
  height: s(FIELD_H),
  borderRadius: s(FIELD_R),
  boxShadow: `0 ${s(1)} ${s(2.3)} rgba(0,0,0,0.25)`,
};

const isHex = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);

export default function DoodlesPanel({
  pen,
  setPen,
  tool,
  setTool,
  onClose,
  mobile = false,
}: {
  pen: PenSettings;
  setPen: React.Dispatch<React.SetStateAction<PenSettings>>;
  tool: DoodleTool;
  setTool: (tool: PanelTool) => void;
  onClose: () => void;
  /**
   * Bottom sheet on the portrait layout. The panel stops being draggable, and
   * its pop-outs open upward — anchored to the right edge there is no page
   * left of them to open into.
   */
  mobile?: boolean;
}) {
  const [brushesOpen, setBrushesOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  /** Returning to Shapes should hand back the shape you were last using. */
  const [lastShape, setLastShape] = useState<ShapeId>("rect");

  // --- panel drag ----------------------------------------------------------
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [moving, setMoving] = useState(false);
  const origin = useRef({ px: 0, py: 0, ox: 0, oy: 0 });

  const startDrag = (event: React.PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button, input, label, [data-picker]")) return;
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

  /** Previews are drawn with the brush's real settings, not a stand-in. */
  const preview = (brush: BrushId, width: number) =>
    renderStroke(
      {
        id: 0,
        points: SAMPLE,
        color: "#ffffff",
        opacity: 1,
        width,
        brush,
        style: "solid",
      },
      1,
    );

  const hex = hexDraft ?? pen.color;
  const mode = modeOf(tool);
  /** Weight, opacity and line style belong to the two stroke-based modes. */
  const strokes = mode !== "text";

  const label = (text: string) => (
    <span style={{ fontSize: s(13), lineHeight: s(16) }}>{text}</span>
  );

  /** The narrow white number field used by weight, opacity and text size. */
  const numberField = (
    props: {
      value: number;
      min: number;
      max: number;
      onChange: (n: number) => void;
      ariaLabel: string;
      suffix?: string;
      icon?: React.ReactNode;
    },
  ) => (
    <div
      style={{ ...fieldStyle, paddingInline: s(14), columnGap: s(8) }}
      /*
       * `w-full`, not `flex-1`. This sits in a *column* — label above, field
       * below — so `flex-1` resolves to `flex: 1 1 0%` and the basis of 0
       * overrides the explicit height, leaving the field to size itself from
       * its content. Weight and Opacity were rendering at half the height of
       * the Colour field beside them, which uses the same `fieldStyle`.
       */
      className="flex w-full items-center border border-black/10 bg-white"
    >
      {props.icon}
      <input
        type="number"
        min={props.min}
        max={props.max}
        value={props.value}
        onChange={(e) =>
          props.onChange(Math.min(props.max, Math.max(props.min, +e.target.value)))
        }
        aria-label={props.ariaLabel}
        style={{ fontSize: s(17), width: s(64) }}
        className="min-w-0 flex-1 bg-transparent text-black focus:outline-none"
      />
      {props.suffix ? (
        <span style={{ fontSize: s(17) }} className="shrink-0 text-black">
          {props.suffix}
        </span>
      ) : null}
    </div>
  );

  return (
    <>
      <section
        aria-label="Doodles"
        onPointerDown={mobile ? undefined : startDrag}
        onPointerMove={mobile ? undefined : onDrag}
        onPointerUp={mobile ? undefined : endDrag}
        onPointerCancel={mobile ? undefined : endDrag}
        style={{
          ...(mobile ? sheetScaleVars(PANEL_W) : panelScaleVars),
          ...panelStyle,
          width: s(PANEL_W),
          padding: s(28),
          rowGap: s(18),
          fontFamily: bodyFont,
          bottom: mobile ? SHEET_BOTTOM : undefined,
          transform: mobile ? undefined : `translate(${offset.x}px, ${offset.y}px)`,
          touchAction: mobile ? undefined : "none",
        }}
        className={`absolute z-45 flex flex-col ${panelClass} ${
          mobile
            ? "left-1/2 -translate-x-1/2"
            : `left-[14%] top-[18%] ${
                moving ? "cursor-grabbing select-none" : "cursor-grab"
              }`
        }`}
      >
        <header className="flex items-center">
          <h2
            style={{
              fontFamily: displayFont,
              fontSize: s(26),
              lineHeight: s(30),
              fontWeight: 500,
            }}
            className="text-[#1e1e1e]"
          >
            Doodles
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close doodles"
            style={{ width: s(36), height: s(34) }}
            className="ml-auto flex cursor-pointer items-center justify-center transition-transform hover:scale-105 active:scale-95"
          >
            <Cross size={19} />
          </button>
        </header>

        {/*
          What you are about to make. Picking a mode picks the tool with it —
          Draw is the pencil, Text is the text box, and Shapes hands back
          whichever shape you were last using rather than resetting.
        */}
        <div
          role="tablist"
          aria-label="What to add"
          style={{ columnGap: s(6), padding: s(5), borderRadius: s(14) }}
          className="flex bg-black/[0.06]"
        >
          {MODES.map((option) => {
            const on = mode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={on}
                aria-label={option.label}
                onClick={() =>
                  setTool(
                    option.id === "draw"
                      ? "pencil"
                      : option.id === "text"
                        ? "text"
                        : lastShape,
                  )
                }
                style={{
                  paddingBlock: s(10),
                  borderRadius: s(10),
                  rowGap: s(2),
                  boxShadow: on ? `0 ${s(1)} ${s(2.3)} rgba(0,0,0,0.2)` : undefined,
                }}
                className={`flex flex-1 cursor-pointer flex-col items-center transition ${
                  on ? "bg-[#fff68d] text-[#3d0e26]" : "text-black/55 hover:bg-white/50"
                }`}
              >
                <span style={{ fontSize: s(14), lineHeight: s(17) }}>
                  {option.label}
                </span>
                <span
                  style={{ fontSize: s(10), lineHeight: s(12) }}
                  className={on ? "text-[#3d0e26]/60" : "text-black/35"}
                >
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>

        {mode === "draw" ? (
          <div style={{ rowGap: s(8) }} className="flex flex-col">
            {label("Brush")}
            <button
              type="button"
              onClick={() => setBrushesOpen((open) => !open)}
              aria-label="Choose brush"
              aria-expanded={brushesOpen}
              style={{ ...fieldStyle, height: s(70), paddingInline: s(14) }}
              className="flex cursor-pointer items-center border border-black/10 bg-white"
            >
              <svg
                viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`}
                preserveAspectRatio="none"
                style={{ height: s(38) }}
                className="flex-1"
                aria-hidden
              >
                {preview(pen.brush, 8).map((path, i) => (
                  <path key={i} d={path.d} fill="#3d0e26" fillOpacity={path.opacity} />
                ))}
              </svg>
              <svg
                viewBox="0 0 20 20"
                style={{ width: s(16), height: s(16), marginLeft: s(6) }}
                className="shrink-0"
                aria-hidden
              >
                <path
                  d="M5 8 L10 13 L15 8"
                  stroke="#3d0e26"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        ) : null}

        {mode === "shapes" ? (
          <div style={{ rowGap: s(8) }} className="flex flex-col">
            {label("Shape")}
            <div
              style={{ gap: s(8) }}
              className="grid grid-cols-3"
            >
              {SHAPES.map((option) => {
                const on = tool === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setLastShape(option.id);
                      setTool(option.id);
                    }}
                    aria-label={option.label}
                    aria-pressed={on}
                    style={{
                      height: s(64),
                      borderRadius: s(FIELD_R),
                      borderWidth: s(on ? 2.5 : 1),
                      rowGap: s(4),
                      boxShadow: `0 ${s(1)} ${s(2.3)} rgba(0,0,0,0.2)`,
                    }}
                    className={`flex cursor-pointer flex-col items-center justify-center border transition ${
                      on
                        ? "border-[#9d3124] bg-[#fff68d]"
                        : "border-black/10 bg-white/70 hover:bg-white"
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      style={{ width: s(19), height: s(19) }}
                      aria-hidden
                    >
                      <path
                        d={option.icon}
                        fill="none"
                        stroke="#1e1e1e"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span
                      style={{ fontSize: s(10), lineHeight: s(12) }}
                      className="text-[#3d0e26]/70"
                    >
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {mode === "text" ? (
          <div style={{ rowGap: s(8) }} className="flex flex-col">
            {label("Font")}
            {/*
              The sample *is* the label — each face writes its own name, so the
              choice can be made by eye without reading a list of font names
              nobody recognises.
            */}
            <div style={{ gap: s(7) }} className="flex flex-wrap">
              {NOTE_FONTS.map((font) => {
                const on = pen.font === font.id;
                return (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => setPen((p) => ({ ...p, font: font.id }))}
                    aria-pressed={on}
                    title={font.label}
                    style={{
                      height: s(38),
                      paddingInline: s(13),
                      borderRadius: s(FIELD_R),
                      borderWidth: s(on ? 2.5 : 1),
                      fontFamily: font.family,
                      fontSize: s(16 * font.scale),
                      boxShadow: `0 ${s(1)} ${s(2.3)} rgba(0,0,0,0.2)`,
                    }}
                    className={`flex cursor-pointer items-center justify-center leading-none transition ${
                      on
                        ? "border-[#9d3124] bg-[#fff68d] text-[#3d0e26]"
                        : "border-black/10 bg-white/70 text-[#1e1e1e] hover:bg-white"
                    }`}
                  >
                    {font.label}
                  </button>
                );
              })}
            </div>

            <div style={{ columnGap: s(8), marginTop: s(2) }} className="flex items-end">
              <div style={{ rowGap: s(8) }} className="flex flex-1 flex-col">
                {label("Size")}
                {numberField({
                  value: pen.fontSize,
                  min: 8,
                  max: 120,
                  onChange: (fontSize) => setPen((p) => ({ ...p, fontSize })),
                  ariaLabel: "Text size",
                  icon: (
                    <svg
                      viewBox="0 0 20 20"
                      style={{ width: s(18), height: s(18) }}
                      className="shrink-0"
                      aria-hidden
                    >
                      <path
                        d="M3 5 H13 M8 5 V16"
                        stroke="#000"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />
                      <path
                        d="M13 9 H18 M15.5 9 V16"
                        stroke="#000"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  ),
                })}
              </div>
            </div>

            <p
              style={{ fontSize: s(11), lineHeight: s(15) }}
              className="text-black/45"
            >
              Click the page to place a box. Once it is there you can drag,
              resize, rotate and re-wrap it by its handles.
            </p>
          </div>
        ) : null}

        {strokes ? (
          <>
            <div style={{ columnGap: s(10) }} className="flex items-end">
              <div style={{ rowGap: s(8) }} className="flex flex-1 flex-col">
                {label("Weight")}
                {numberField({
                  value: pen.width,
                  min: 1,
                  max: 40,
                  onChange: (width) => setPen((p) => ({ ...p, width })),
                  ariaLabel: "Stroke weight",
                  icon: (
                    <svg
                      viewBox="0 0 20 20"
                      style={{ width: s(18), height: s(18) }}
                      className="shrink-0"
                      aria-hidden
                    >
                      <rect x="2" y="3" width="16" height="1.4" fill="#000" />
                      <rect x="2" y="8" width="16" height="2.6" fill="#000" />
                      <rect x="2" y="14" width="16" height="4" fill="#000" />
                    </svg>
                  ),
                })}
              </div>

              <div style={{ rowGap: s(8) }} className="flex flex-1 flex-col">
                {label("Opacity")}
                {numberField({
                  value: Math.round(pen.opacity * 100),
                  min: 10,
                  max: 100,
                  onChange: (n) => setPen((p) => ({ ...p, opacity: n / 100 })),
                  ariaLabel: "Stroke opacity",
                  suffix: "%",
                })}
              </div>
            </div>

            <div style={{ rowGap: s(8) }} className="flex flex-col">
              {label("Stroke type")}
              <div style={{ columnGap: s(6) }} className="flex">
                {STYLES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPen((p) => ({ ...p, style: option.id }))}
                    aria-pressed={pen.style === option.id}
                    style={{
                      height: s(44),
                      fontSize: s(15),
                      borderRadius: s(FIELD_R),
                      boxShadow: `0 ${s(1)} ${s(2.3)} rgba(0,0,0,0.2)`,
                    }}
                    className={`flex flex-1 cursor-pointer items-center justify-center border transition ${
                      pen.style === option.id
                        ? "border-black/45 bg-white text-black"
                        : "border-black/10 bg-white/60 text-black/55 hover:bg-white"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : null}

        {/* The one thing all three modes share, so it never moves. */}
        <div style={{ rowGap: s(8) }} className="flex flex-col">
          {label("Colour")}
          <div
            style={{ ...fieldStyle, paddingInline: s(14), columnGap: s(9) }}
            className="flex items-center border border-black/10 bg-white"
          >
            <button
              type="button"
              onClick={() => setPickerOpen((open) => !open)}
              aria-label="Pick colour"
              aria-expanded={pickerOpen}
              style={{
                width: s(22),
                height: s(22),
                // A fifth of the side reads as a blob; a small radius keeps
                // the chip square while softening the corner.
                borderRadius: s(2),
                backgroundColor: pen.color,
              }}
              className="shrink-0 cursor-pointer ring-1 ring-black/30 transition-transform hover:scale-105"
            />

            {/*
              Typed hex, so a brand colour can be pasted straight in. Given a
              visible box and a leading # — as bare text on the field's own
              white it read as a label, and nobody tries to type into a label.
            */}
            <label
              style={{
                height: s(38),
                borderRadius: s(8),
                paddingInline: s(9),
                columnGap: s(2),
              }}
              className="flex cursor-text items-center bg-black/[0.045] transition focus-within:bg-black/[0.08] focus-within:ring-1 focus-within:ring-[#9d3124] hover:bg-black/[0.08]"
            >
              <span style={{ fontSize: s(17) }} className="select-none text-black/40">
                #
              </span>
              <input
                value={hex.replace("#", "").toUpperCase()}
                onChange={(e) => {
                  const next = `#${e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6)}`;
                  setHexDraft(next);
                  if (isHex(next)) setPen((p) => ({ ...p, color: next }));
                }}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={() => setHexDraft(null)}
                aria-label="Hex colour"
                placeholder="000000"
                spellCheck={false}
                style={{ fontSize: s(17), width: s(86) }}
                className="bg-transparent uppercase text-black caret-[#9d3124] focus:outline-none"
              />
            </label>
          </div>

          <div style={{ columnGap: s(7), rowGap: s(7) }} className="flex flex-wrap">
            {SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => {
                  setHexDraft(null);
                  setPen((p) => ({ ...p, color: swatch }));
                }}
                aria-label={`Use ${swatch}`}
                style={{
                  width: s(25),
                  height: s(25),
                  borderRadius: s(7),
                  backgroundColor: swatch,
                  borderWidth: s(pen.color === swatch ? 2.5 : 1),
                }}
                className={`cursor-pointer transition-transform hover:scale-110 ${
                  pen.color === swatch ? "border-[#3d0e26]" : "border-black/20"
                }`}
              />
            ))}

            {/* Custom colour, at the end of the row of presets. */}
            <button
              type="button"
              onClick={() => setPickerOpen((open) => !open)}
              aria-label="Custom colour"
              aria-expanded={pickerOpen}
              title="Custom colour"
              style={{
                width: s(25),
                height: s(25),
                borderRadius: s(7),
                borderWidth: s(1),
                fontSize: s(17),
                lineHeight: 1,
              }}
              className={`flex cursor-pointer items-center justify-center border-dashed text-[#3d0e26] transition ${
                pickerOpen
                  ? "border-[#9d3124] bg-[#fff68d]"
                  : "border-black/35 bg-white/60 hover:bg-white"
              }`}
            >
              +
            </button>
          </div>
        </div>

        {pickerOpen ? (
          <ColorPicker
            value={pen.color}
            onChange={(next) => {
              setHexDraft(null);
              setPen((p) => ({ ...p, color: next }));
            }}
            onClose={() => setPickerOpen(false)}
            className={
              mobile
                ? "absolute bottom-full right-0 mb-2"
                : "absolute left-full top-0 ml-2"
            }
          />
        ) : null}

        {/*
          Anchored to the panel's own right edge rather than placed at a page
          coordinate, so it stays attached when the panel is dragged. Uses the
          app's panel treatment: a dark dropdown was borrowed from the reference
          tool's chrome, not from this UI.
        */}
        {brushesOpen && mode === "draw" ? (
          <div
            style={{
              ...panelStyle,
              width: s(210),
              borderRadius: s(14),
              padding: s(10),
              rowGap: s(4),
              ...(mobile ? { marginBottom: s(10) } : { marginLeft: s(10) }),
            }}
            className={`absolute flex flex-col ${
              mobile ? "bottom-full right-0" : "left-full top-0"
            } ${panelClass}`}
          >
            <header
              style={{ paddingInline: s(4), paddingBottom: s(2) }}
              className="flex items-center"
            >
              <span
                style={{ fontSize: s(12) }}
                className="uppercase tracking-[0.16em] text-black/50"
              >
                Brushes
              </span>
              <button
                type="button"
                onClick={() => setBrushesOpen(false)}
                aria-label="Close brushes"
                style={{ width: s(20), height: s(20) }}
                className="ml-auto flex cursor-pointer items-center justify-center"
              >
                <Cross size={11} />
              </button>
            </header>

            {BRUSHES.map((brush) => (
              <button
                key={brush.id}
                type="button"
                onClick={() => {
                  setPen((p) => ({ ...p, brush: brush.id }));
                  setBrushesOpen(false);
                }}
                style={{
                  borderRadius: s(9),
                  paddingInline: s(8),
                  paddingBlock: s(5),
                  rowGap: s(1),
                  borderWidth: s(1),
                }}
                className={`flex cursor-pointer flex-col items-start text-left transition ${
                  pen.brush === brush.id
                    ? "border-[#9d3124] bg-[#fff68d]"
                    : "border-transparent hover:bg-white/45"
                }`}
              >
                <span style={{ fontSize: s(11) }} className="text-[#3d0e26]">
                  {brush.label}
                </span>
                <svg
                  viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`}
                  preserveAspectRatio="none"
                  style={{ height: s(26) }}
                  className="w-full"
                  aria-hidden
                >
                  {preview(brush.id, 8).map((path, i) => (
                    <path key={i} d={path.d} fill="#3d0e26" fillOpacity={path.opacity} />
                  ))}
                </svg>
              </button>
            ))}
          </div>
        ) : null}
      </section>
    </>
  );
}
