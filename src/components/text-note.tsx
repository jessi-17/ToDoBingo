"use client";

import { useRef, useState } from "react";

import Cross from "./cross";
import { ARTBOARD_HEIGHT, s, scaleVars } from "./figma-scale";
import {
  noteFont,
  NOTE_MAX_SIZE,
  NOTE_MAX_WIDTH,
  NOTE_MIN_SIZE,
  NOTE_MIN_WIDTH,
  type Note,
} from "./note-fonts";

/**
 * A text box written straight onto the page — and, once it is there, an object
 * on an artboard: move it, scale it, spin it, re-wrap it.
 *
 * Typing and dragging cannot share the same surface, because a press in the
 * body has to place the caret. So every transform lives on its own handle, and
 * they follow the same conventions the stickers already established: yellow
 * pulls it bigger, blue turns it, and the ring is dashed while it is selected.
 *
 * Scaling and wrapping are deliberately *separate* gestures rather than one
 * corner drag. For a picture they are the same thing; for text they are not —
 * making the type bigger and making the column narrower are different
 * intentions, and a single handle can only guess which one you meant.
 *
 * The text itself is *uncontrolled*. React rewriting a contentEditable's
 * children on every keystroke collapses the selection to the end of the node,
 * so the value is seeded once through the ref and read back on blur.
 */
type Gesture = "idle" | "moving" | "resizing" | "rotating" | "widening";

export default function TextNote({
  note,
  selected,
  fresh,
  onSelect,
  onChange,
  onCommit,
  onLand,
  onRemove,
}: {
  note: Note;
  selected: boolean;
  /** Newly placed, so it takes the caret without the user having to click. */
  fresh?: boolean;
  onSelect: () => void;
  onChange: (next: Note) => void;
  /** Typing finished. Separate from onChange so an empty note can be swept up
      on blur without a drag — which also reports a change — deleting it. */
  onCommit: (text: string) => void;
  /** Released with its middle over a bingo square: it belongs to the card now. */
  onLand?: (cellIndex: number) => void;
  onRemove: () => void;
}) {
  const [gesture, setGesture] = useState<Gesture>("idle");
  const face = noteFont(note.font);
  /**
   * The note's own box. Handles measure the page through this rather than
   * through themselves: a handle's offsetParent is the note, not the page, so
   * asking it for the page bounds would size every drag against the note.
   */
  const root = useRef<HTMLDivElement>(null);
  /** Captured on pointerdown; deriving these per-move races React state. */
  const grab = useRef({
    px: 0,
    py: 0,
    xPct: 0,
    yPct: 0,
    size: 0,
    width: 0,
    boxW: 1,
    boxH: 1,
    unit: 1,
    dist: 1,
    angle: 0,
    rotation: 0,
  });

  const measure = (event: React.PointerEvent) => {
    const page = (
      root.current?.offsetParent as HTMLElement | null
    )?.getBoundingClientRect();
    if (!page || !root.current) return null;

    const unit = page.height / ARTBOARD_HEIGHT;
    const centreX = page.left + note.xPct * page.width;
    const centreY = page.top + note.yPct * page.height;

    grab.current = {
      px: event.clientX,
      py: event.clientY,
      xPct: note.xPct,
      yPct: note.yPct,
      size: note.size,
      // Seeded from what is on screen when the note is still hugging its text,
      // so the first pull of the wrap handle continues from the current width
      // instead of jumping to some nominal one.
      width: note.width ?? root.current.offsetWidth / unit,
      boxW: page.width,
      boxH: page.height,
      unit,
      dist: Math.hypot(event.clientX - centreX, event.clientY - centreY) || 1,
      angle: Math.atan2(event.clientY - centreY, event.clientX - centreX),
      rotation: note.rotation,
    };
    return grab.current;
  };

  /**
   * Every handle starts the same way and only the gesture differs, but each
   * gets its own named function rather than one curried factory: a factory
   * called during render counts as reading the refs it closes over, which the
   * rules of hooks rightly refuse.
   */
  const begin = (
    event: React.PointerEvent<HTMLElement>,
    next: Exclude<Gesture, "idle">,
  ) => {
    // The page deselects on its own pointerdown, and the handles only exist
    // while the note is selected — letting this through would unmount the
    // handle under the finger and the gesture would end before it began.
    event.stopPropagation();
    // And the browser's default would move focus out of the text.
    event.preventDefault();
    if (!measure(event)) return;
    setGesture(next);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const startMove = (event: React.PointerEvent<HTMLElement>) =>
    begin(event, "moving");
  const startResize = (event: React.PointerEvent<HTMLElement>) =>
    begin(event, "resizing");
  const startRotate = (event: React.PointerEvent<HTMLElement>) =>
    begin(event, "rotating");
  const startWiden = (event: React.PointerEvent<HTMLElement>) =>
    begin(event, "widening");

  const onMove = (event: React.PointerEvent) => {
    if (gesture === "idle") return;
    event.stopPropagation();
    const g = grab.current;

    if (gesture === "moving") {
      onChange({
        ...note,
        xPct: Math.min(Math.max(g.xPct + (event.clientX - g.px) / g.boxW, 0.01), 0.99),
        yPct: Math.min(Math.max(g.yPct + (event.clientY - g.py) / g.boxH, 0.01), 0.99),
      });
      return;
    }

    if (gesture === "widening") {
      /*
       * Only the part of the drag that runs along the note's *own* long axis
       * counts, so a rotated note still widens the way it looks like it should
       * rather than tracking the screen's horizontal. The note is centred on
       * its anchor — as stickers are — so the edge under the finger moves half
       * as far as the width grows, hence the doubling.
       */
      const radians = (note.rotation * Math.PI) / 180;
      const along =
        (event.clientX - g.px) * Math.cos(radians) +
        (event.clientY - g.py) * Math.sin(radians);

      onChange({
        ...note,
        width: Math.min(
          Math.max(g.width + (2 * along) / g.unit, NOTE_MIN_WIDTH),
          NOTE_MAX_WIDTH,
        ),
      });
      return;
    }

    const centreX = g.boxW * g.xPct;
    const centreY = g.boxH * g.yPct;
    const page = (
      root.current?.offsetParent as HTMLElement | null
    )?.getBoundingClientRect();
    if (!page) return;

    if (gesture === "rotating") {
      // Angle swept around the centre since the grab, so the note follows the
      // pointer rather than snapping its corner to it.
      const angle = Math.atan2(
        event.clientY - (page.top + centreY),
        event.clientX - (page.left + centreX),
      );
      onChange({
        ...note,
        rotation: g.rotation + ((angle - g.angle) * 180) / Math.PI,
      });
      return;
    }

    // Scale by how much further the pointer is from the centre than where it
    // started — a corner handle reads as "pull it bigger".
    const distance = Math.hypot(
      event.clientX - (page.left + centreX),
      event.clientY - (page.top + centreY),
    );
    onChange({
      ...note,
      size: Math.min(
        Math.max((g.size * distance) / g.dist, NOTE_MIN_SIZE),
        NOTE_MAX_SIZE,
      ),
    });
  };

  const end = (event: React.PointerEvent) => {
    if (gesture === "idle") return;
    event.stopPropagation();
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    setGesture("idle");
    if (gesture !== "moving") return;

    /*
     * Dropped onto the board? The card is the thing that gets exported, so a
     * note released over it stops being page furniture and becomes part of a
     * square.
     *
     * Hit-tested from the note's own middle rather than from the pointer: the
     * pointer is on the grip, which sits above and to the left of the note, and
     * a note lands where it *looks* like it landed. `elementsFromPoint` returns
     * the whole stack, which is what makes this work at all — the note is
     * painted over the card, so the singular version would only ever find the
     * note itself.
     */
    const box = root.current?.getBoundingClientRect();
    if (!box || !onLand) return;

    const cell = document
      .elementsFromPoint(box.left + box.width / 2, box.top + box.height / 2)
      .map((el) => el.closest("[data-cell]"))
      .find(Boolean);
    if (!cell) return;

    const index = Number(cell.getAttribute("data-cell"));
    if (Number.isInteger(index)) onLand(index);
  };

  const dot = (extra: string) =>
    `absolute flex items-center justify-center rounded-full border-[#3d0e26] transition-transform hover:scale-110 ${extra}`;

  return (
    <div
      ref={root}
      style={{
        ...scaleVars,
        left: `${note.xPct * 100}%`,
        top: `${note.yPct * 100}%`,
        // Standalone `rotate`, so it composes with the centring translate that
        // Tailwind emits rather than replacing it.
        rotate: `${note.rotation}deg`,
      }}
      /*
       * Above the drawing surface (z-35), below the sidebar and panels (z-40+).
       * A note is text you come back to and keep editing, and the drawing layer
       * covers the whole page while any tool is in hand — leaving notes beneath
       * it means picking up the pencil makes every note on the page untouchable.
       * The cost is that you cannot doodle *over* a note, which is the rarer of
       * the two by a wide margin.
       */
      className="note-in absolute z-[38] -translate-x-1/2 -translate-y-1/2"
    >
      <div
        ref={(el) => {
          if (!el) return;
          // Seed once: an already-populated node is mid-edit and must be left
          // alone, or the caret jumps to the end on every render.
          if (el.textContent === "") el.textContent = note.text;
          if (fresh && document.activeElement !== el) el.focus();
        }}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        tabIndex={0}
        aria-label="Text note"
        data-note
        data-placeholder="type…"
        spellCheck={false}
        onPointerDown={(event) => {
          // The page clears the current selection on its own pointerdown, so
          // this must not reach it — otherwise the note deselects the instant
          // it is clicked and the handles never appear.
          event.stopPropagation();
          onSelect();
        }}
        onBlur={(event) => onCommit(event.currentTarget.textContent ?? "")}
        onKeyDown={(event) => {
          if (event.key === "Escape") event.currentTarget.blur();
        }}
        style={{
          fontFamily: face.family,
          fontSize: s(note.size * face.scale),
          lineHeight: 1.25,
          color: note.color,
          minWidth: s(48),
          // Until the wrap handle is used the box hugs its text; after that it
          // holds the width it was given.
          ...(note.width
            ? { width: s(note.width) }
            : { maxWidth: s(620) }),
          paddingInline: s(6),
          paddingBlock: s(2),
          borderRadius: s(6),
        }}
        className="cursor-text break-words whitespace-pre-wrap outline-none"
      />

      {selected ? (
        <>
          <span
            style={{ outlineWidth: s(1.5), outlineOffset: s(3) }}
            className="pointer-events-none absolute inset-0 rounded-[2px] outline-dashed outline-[#3d0e26]/45"
          />

          {/* Move and delete, on a bar clear of the text so neither is typed on. */}
          <div
            style={{
              top: s(-30),
              columnGap: s(4),
              padding: s(3),
              borderRadius: s(8),
            }}
            className="absolute left-0 flex items-center bg-[#fffdf7]/85 shadow-sm ring-1 ring-black/10"
          >
            <span
              onPointerDown={startMove}
              onPointerMove={onMove}
              onPointerUp={end}
              onPointerCancel={end}
              aria-label="Move note"
              style={{ touchAction: "none", width: s(26), height: s(18) }}
              className={`flex items-center justify-center rounded ${
                gesture === "moving" ? "cursor-grabbing" : "cursor-grab"
              }`}
            >
              <svg viewBox="0 0 18 12" style={{ width: s(16) }} aria-hidden>
                {[3, 6, 9].map((y) =>
                  [4, 9, 14].map((x) => (
                    <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" fill="#3d0e26" />
                  )),
                )}
              </svg>
            </span>

            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onRemove();
              }}
              aria-label="Delete note"
              style={{ width: s(20), height: s(18) }}
              className="flex cursor-pointer items-center justify-center rounded transition hover:bg-black/10"
            >
              <Cross size={11} />
            </button>
          </div>

          <button
            type="button"
            onPointerDown={startRotate}
            onPointerMove={onMove}
            onPointerUp={end}
            onPointerCancel={end}
            aria-label="Rotate note"
            style={{
              touchAction: "none",
              width: s(16),
              height: s(16),
              right: s(-9),
              top: s(-9),
              borderWidth: s(1.5),
            }}
            className={dot("cursor-grab bg-[#93d1fc] active:cursor-grabbing")}
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-2/3 w-2/3" aria-hidden>
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
            onPointerDown={startResize}
            onPointerMove={onMove}
            onPointerUp={end}
            onPointerCancel={end}
            aria-label="Resize note"
            title="Drag to scale the type"
            style={{
              touchAction: "none",
              width: s(16),
              height: s(16),
              right: s(-9),
              bottom: s(-9),
              borderWidth: s(1.5),
            }}
            className={dot("cursor-nwse-resize bg-[#fff68d]")}
          />

          <button
            type="button"
            onPointerDown={startWiden}
            onPointerMove={onMove}
            onPointerUp={end}
            onPointerCancel={end}
            aria-label="Set note width"
            title="Drag to change where the text wraps"
            style={{
              touchAction: "none",
              width: s(9),
              height: s(22),
              right: s(-6),
              top: "50%",
              borderWidth: s(1.5),
              borderRadius: s(5),
              translate: "0 -50%",
            }}
            className="absolute cursor-ew-resize border-[#3d0e26] bg-[#f6aff2] transition-transform hover:scale-110"
          />
        </>
      ) : null}
    </div>
  );
}
