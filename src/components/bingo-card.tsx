"use client";

import { EMPTY_CELL, fitSize, withAlpha, type BoardCell } from "./board";
import {
  CARD_BG,
  CARD_H,
  CARD_W,
  CELL_TEXT,
  FOOTER,
  GRAIN,
  GRID,
  LETTERS,
  OVERLAY,
  PANEL,
  PANEL_BG,
  SCRIBBLE,
  SCRIBBLE_MS,
  SCRIBBLE_WIDTH,
  SPARKS,
  STICKERS,
  TILE,
  TILE_BG,
  TITLE,
} from "./card-layout";
import { STAR_SHAPES } from "./star-shapes";

/**
 * The bingo card, from Figma node 128:689.
 *
 * Laid out entirely in the card’s own coordinates — see ./card-layout, which
 * both this and the canvas exporter read, so the picture the user downloads
 * cannot drift from the one on screen.
 */
/** Never let the 1px keylines vanish when the card is scaled down. */
const HAIRLINE = "max(1px, calc(1 * var(--bu, 1px)))";

/**
 * One of the card's two headings. Editable straight on the card — no edit mode
 * to enter and nothing to save; it is an input that has been dressed to look
 * exactly like the text it replaces, and it only becomes one when the parent
 * offers somewhere to put the change.
 *
 * Spans the pink panel rather than the full card so its hover tint lines up
 * with the artwork instead of running to the card's edges.
 */
function Heading({
  value,
  onChange,
  top,
  u,
  label,
}: {
  value: string;
  onChange?: (next: string) => void;
  top: number;
  u: (n: number) => string;
  label: string;
}) {
  /*
   * Ligatures off. The display face is the Recoleta DEMO cut, which advertises
   * `fi`/`fl` but ships no glyph for them — "finish" comes out with a tofu box
   * where the first two letters should be. That was invisible while the
   * headings were fixed strings chosen to avoid it; now that anyone can type
   * into them it is a matter of time. A licensed Recoleta should make this
   * unnecessary.
   */
  const type = {
    fontSize: u(TITLE.size),
    lineHeight: u(TITLE.line),
    fontVariantLigatures: "none",
  };

  if (!onChange) {
    return (
      <p
        style={{ top: u(top), ...type }}
        className="absolute w-full text-center text-black"
      >
        {value}
      </p>
    );
  }

  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
      spellCheck={false}
      style={{
        top: u(top),
        left: u(PANEL.x),
        width: u(PANEL.w),
        height: u(TITLE.line),
        borderRadius: u(8),
        ...type,
      }}
      className="absolute z-20 cursor-text bg-transparent text-center text-black transition-colors hover:bg-black/[0.06] focus:bg-black/[0.09] focus:outline-none"
    />
  );
}

export default function BingoCard({
  cells,
  title = "you are a work in progress",
  footer = "Act like the Girl you want to be !",
  onTitleChange,
  onFooterChange,
  onToggleCell,
  style,
  className = "",
}: {
  /**
   * The 25 squares. Fully controlled: a square's struck state is owned by
   * whoever owns the task list, which is what keeps the card and the to-do list
   * showing the same thing rather than each remembering its own version.
   */
  cells: BoardCell[];
  title?: string;
  footer?: string;
  /** Supply these to make the two headings editable on the card itself. */
  onTitleChange?: (next: string) => void;
  onFooterChange?: (next: string) => void;
  onToggleCell?: (index: number) => void;
  /** Set `--bu` here — one design pixel, in whatever unit the parent works in. */
  style?: React.CSSProperties;
  className?: string;
}) {
  // One design pixel, as a length. The parent sets --bu from the space it has,
  // so the whole card scales by CSS alone and every ratio in the design holds.
  const u = (n: number) => `calc(${n} * var(--bu, 1px))`;

  return (
    <div
      style={{
        ...style,
        width: u(CARD_W),
        height: u(CARD_H),
        backgroundColor: CARD_BG,
        fontFamily: "var(--font-display)",
      }}
      data-card
      className={`relative overflow-hidden ${className}`}
    >
      {/*
        Card texture. Figma specifies Linear Burn, which CSS does not have —
        it is a Photoshop mode, not one of the sixteen in the blend spec.
        Multiply is the closest available: both darken by the blend layer, and
        at 31% opacity the difference between them is barely perceptible,
        whereas color-burn (the other candidate) crushes to black.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={OVERLAY.green.src}
        alt=""
        style={{
          width: u(CARD_W),
          height: u(OVERLAY.green.h),
          top: u(OVERLAY.green.y),
          opacity: OVERLAY.green.alpha,
          mixBlendMode: "multiply",
        }}
        className="pointer-events-none absolute left-0 max-w-none select-none"
      />

      <Heading
        value={title}
        onChange={onTitleChange}
        top={TITLE.y}
        u={u}
        label="Card heading"
      />

      {/* BINGO */}
      {LETTERS.map((letter) => (
        <div
          key={letter.id}
          style={{
            left: u(letter.x),
            top: u(TILE.y),
            width: u(letter.w),
            height: u(TILE.h),
            backgroundColor: TILE_BG,
            borderWidth: HAIRLINE,
            // Rounded at the top only — the bottom tucks behind the pink panel.
            borderRadius: `${u(16)} ${u(16)} 0 0`,
          }}
          className="absolute overflow-hidden border-black"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={OVERLAY.grain.src}
            alt=""
            style={{
              width: u(240),
              height: u(240),
              left: u(-18),
              top: u(-119),
              opacity: OVERLAY.grain.alpha,
              mixBlendMode: "exclusion",
            }}
            className="pointer-events-none absolute max-w-none select-none"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/icons/bingo-letters/${encodeURIComponent(letter.file)}.svg`}
            alt={letter.id}
            style={{
              width: u(letter.lw),
              height: u(letter.lh),
              top: u(letter.ly),
            }}
            className="absolute left-1/2 -translate-x-1/2 select-none"
          />
        </div>
      ))}

      {/* Pink panel behind the grid */}
      <div
        style={{
          left: u(PANEL.x),
          top: u(PANEL.y),
          width: u(PANEL.w),
          height: u(PANEL.h),
          borderRadius: u(PANEL.r),
          backgroundColor: PANEL_BG,
          borderWidth: HAIRLINE,
        }}
        className="absolute overflow-hidden border-black"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={OVERLAY.pink.src}
          alt=""
          style={{
            width: u(PANEL.w),
            height: u(OVERLAY.pink.h),
            top: u(OVERLAY.pink.y),
            opacity: OVERLAY.pink.alpha,
            mixBlendMode: "overlay",
          }}
          className="pointer-events-none absolute left-0 max-w-none select-none"
        />
      </div>

      {/* Cells sit above the panel so their own fill is not tinted by it. */}
      {Array.from({ length: 25 }, (_, i) => {
        const col = i % 5;
        const row = Math.floor(i / 5);
        const cell = cells[i] ?? EMPTY_CELL;
        const { label, done: hit } = cell;
        /*
         * A square holds either a task or text dropped straight onto the board.
         * A task is set in the card's own mono at a fixed size, because the
         * card is a printed thing and its tasks should look like one another.
         * Dropped text keeps the face it was written in and is sized to fit,
         * because it was placed by hand and is meant to look placed.
         */
        const dropped = Boolean(cell.font);

        return (
          <button
            key={i}
            type="button"
            onClick={() => onToggleCell?.(i)}
            aria-pressed={hit}
            data-cell={i}
            aria-label={label || `Empty square ${i + 1}`}
            style={{
              left: u(GRID.x + col * GRID.pitchX),
              top: u(GRID.y + row * GRID.pitchY),
              width: u(GRID.cell),
              height: u(GRID.cell),
              borderRadius: u(CELL_TEXT.radius),
              padding: u(dropped ? CELL_TEXT.padDropped : CELL_TEXT.pad),
              borderWidth: HAIRLINE,
              backgroundColor: "#ffffff",
              fontFamily: dropped ? cell.font : "var(--font-mono-card)",
              color: dropped ? cell.color : undefined,
              /*
               * 14 leaves about ten mono characters to the line across the 87
               * units of a square's text column, which is where a task label
               * stops being something you squint at. Much past this and short
               * labels look fine while anything of real length runs out of
               * square.
               */
              fontSize: u(dropped ? fitSize(label) : CELL_TEXT.size),
              lineHeight: dropped ? 1.15 : u(CELL_TEXT.line),
            }}
            className="absolute cursor-pointer border-black text-left align-top leading-tight text-black"
          >
            {/*
              Above the frost, not under it. Even at 12 units the square's type
              is only about 9px at the size the card sits on the notepad, and
              any blur worth calling frosted erases it — a bingo card you cannot
              read back is not a record of anything. The scribble *does* go
              under the glass, which is what carries the effect; the label rides
              on the surface, dimmed just enough to read as finished.
            */}
            <span
              style={{ opacity: hit ? 0.72 : 1 }}
              className={`relative z-10 block ${
                dropped ? "flex h-full items-center justify-center text-center" : ""
              }`}
            >
              {label}
            </span>

            {/* A struck square is scribbled over by hand, then sealed. */}
            {hit ? (
              <>
                <svg
                  viewBox="0 0 100 100"
                  aria-hidden
                  style={{ ["--scribble-ms" as string]: `${SCRIBBLE_MS}ms` }}
                  className="pointer-events-none absolute inset-0 h-full w-full"
                >
                  <path
                    d={SCRIBBLE}
                    // 100 means "the whole path" whatever its real arc length,
                    // so the dash animation needs no retuning if the shape of
                    // the scribble is ever changed.
                    pathLength={100}
                    stroke="#3d0e26"
                    // Laid down heavier than it needs to look, because the
                    // glass over it takes a good deal of the weight back out.
                    strokeWidth={SCRIBBLE_WIDTH}
                    strokeOpacity={0.95}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="scribble-draw"
                  />
                  <image
                    href="/icons/todo/pencil.png"
                    width={19}
                    height={25}
                    style={{ offsetPath: `path("${SCRIBBLE}")` }}
                    className="scribble-hand"
                  />
                </svg>

                {/*
                  The same frosted sheet as the disc's hub, dialled up — this
                  square is a fifth of the hub's size, so proportionally more
                  blur is what makes it read as glass rather than as a wash.
                  What it diffuses is the scribble and the square's own fill;
                  the label is painted above it, so the blur can be as heavy as
                  the effect wants without costing legibility. Sized in --bu so
                  the frost thickens and thins with the card, instead of
                  coarsening as the card shrinks.

                  The glass takes a hint of the task's own row colour, so a
                  finished square still says which task it was at a glance and
                  the board picks up the list's palette. Kept faint on purpose:
                  push the tint much past this and it stops reading as glass
                  and starts reading as a filled-in square, which is exactly
                  what the old yellow highlight did wrong.
                */}
                <span
                  aria-hidden
                  style={{
                    borderRadius: u(12),
                    backgroundColor: "rgba(255, 253, 247, 0.28)",
                    backgroundImage: `linear-gradient(${withAlpha(cell.tint, 0.3)}, ${withAlpha(cell.tint, 0.3)})`,
                    backdropFilter: `blur(${u(3.4)}) saturate(135%) brightness(1.05)`,
                    WebkitBackdropFilter: `blur(${u(3.4)}) saturate(135%) brightness(1.05)`,
                    boxShadow: `inset 0 ${u(1.5)} 0 rgba(255,255,255,0.9), inset ${u(1)} 0 0 rgba(255,255,255,0.5), inset 0 ${u(-2.5)} ${u(5)} rgba(61,14,38,0.16)`,
                    ["--frost-delay" as string]: `${SCRIBBLE_MS - 100}ms`,
                  }}
                  className="frost-settle pointer-events-none absolute inset-0 block"
                />
              </>
            ) : null}
          </button>
        );
      })}

      {/* Grain patches, above the cells as in the design. */}
      {GRAIN.map((patch, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={OVERLAY.grain.src}
          alt=""
          style={{
            left: u(patch.x),
            top: u(patch.y),
            width: u(patch.size),
            height: u(patch.size),
            opacity: OVERLAY.grain.alpha,
            mixBlendMode: "overlay",
          }}
          className="pointer-events-none absolute max-w-none select-none"
        />
      ))}

      <Heading
        value={footer}
        onChange={onFooterChange}
        top={FOOTER.y}
        u={u}
        label="Card footer"
      />

      {/* Stickers and sparkles, over the grid so they read as stuck on top. */}
      {STICKERS.map((sticker) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={sticker.src}
          src={sticker.src}
          alt=""
          draggable={false}
          style={{
            left: u(sticker.x),
            top: u(sticker.y),
            width: u(sticker.w),
            height: u(sticker.h),
            rotate: `${sticker.tilt}deg`,
          }}
          className="pointer-events-none absolute z-10 max-w-none select-none"
        />
      ))}

      {SPARKS.map((spark, i) => {
        const shape = STAR_SHAPES[spark.shape % STAR_SHAPES.length];
        return (
          <svg
            key={i}
            viewBox={shape.viewBox}
            fill="none"
            aria-hidden
            style={{
              left: u(spark.x),
              top: u(spark.y),
              width: u(spark.size),
              height: u(spark.size),
              rotate: `${spark.tilt}deg`,
            }}
            className="pointer-events-none absolute z-10"
          >
            <path d={shape.fill} fill={shape.fillColor} />
            <path
              d={shape.outline}
              stroke={shape.stroke}
              strokeWidth={shape.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      })}

    </div>
  );
}
