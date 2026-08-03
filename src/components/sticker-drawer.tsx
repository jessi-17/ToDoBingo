"use client";

import { useRef, useState } from "react";

import Cross from "./cross";
import {
  bodyFont,
  displayFont,
  panelClass,
  panelStyle,
  s,
  panelScaleVars,
  SHEET_BOTTOM,
  sheetScaleVars,
} from "./figma-scale";
import { sfx } from "./sounds";
import { STICKERS, type Sticker } from "./sticker-manifest";

/**
 * The sticker drawer: shelves of stickers you drag out onto the page.
 *
 * Four to a shelf, shelves stacked as deep as the collection goes, the whole
 * stack scrolling inside the drawer. Tiles bottom-align so each sticker looks
 * like it is standing on its shelf rather than floating above it.
 *
 * Dragging is pointer-based rather than HTML5 drag-and-drop: the rest of the
 * app already moves things this way, and HTML5 drag gives no control over the
 * drag image on touch.
 */
const COLUMNS = 4;
/** Artboard units. */
const TILE = 96;
const GAP = 16;
/** Padding, plus a gutter so the scrollbar does not squeeze the columns. */
const DRAWER_WIDTH = COLUMNS * TILE + (COLUMNS - 1) * GAP + 56 + 24;

export type DrawerDrag = {
  sticker: Sticker;
  /** Viewport coordinates, for the floating preview. */
  x: number;
  y: number;
};

export default function StickerDrawer({
  onClose,
  onDrop,
  uploads,
  onUpload,
  onRemoveUpload,
  mobile = false,
}: {
  onClose: () => void;
  onDrop: (sticker: Sticker, clientX: number, clientY: number) => void;
  /** Bottom sheet on the portrait layout; the drawer stops being draggable. */
  mobile?: boolean;
  /**
   * Owned by the page, not by this drawer. Kept here they would be thrown away
   * every time the drawer was closed — you would upload a sticker, shut the
   * drawer to place something else, and find your upload gone.
   */
  uploads: Sticker[];
  onUpload: (files: FileList) => Promise<{ added: number; skipped: number }>;
  onRemoveUpload: (id: string) => void;
}) {
  const [drag, setDrag] = useState<DrawerDrag | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // --- drawer drag ---------------------------------------------------------
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [movingDrawer, setMovingDrawer] = useState(false);
  const origin = useRef({ px: 0, py: 0, ox: 0, oy: 0 });

  const startDrawerDrag = (event: React.PointerEvent<HTMLElement>) => {
    /*
     * `label` matters as much as the rest. The upload control is a label
     * wrapping a hidden file input, and a label only opens its input because
     * the *click* forwards to it — but capturing the pointer here retargets
     * pointerup to this section, so no click is ever synthesised on the label
     * and the file picker never opens. Pressing "upload your own" just slid the
     * drawer a pixel and did nothing else.
     */
    if ((event.target as HTMLElement).closest("button, input, label, [data-tile]")) {
      return;
    }
    origin.current = {
      px: event.clientX,
      py: event.clientY,
      ox: offset.x,
      oy: offset.y,
    };
    setMovingDrawer(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrawer = (event: React.PointerEvent) => {
    if (!movingDrawer) return;
    const { px, py, ox, oy } = origin.current;
    setOffset({ x: ox + (event.clientX - px), y: oy + (event.clientY - py) });
  };

  const endDrawerDrag = (event: React.PointerEvent<HTMLElement>) => {
    setMovingDrawer(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  // --- pulling a sticker out of the drawer ---------------------------------
  const startPull = (
    event: React.PointerEvent<HTMLButtonElement>,
    sticker: Sticker,
  ) => {
    event.stopPropagation();
    sfx.pickup();
    setDrag({ sticker, x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const movePull = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    event.stopPropagation();
    setDrag({ ...drag, x: event.clientX, y: event.clientY });
  };

  const endPull = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    event.stopPropagation();
    event.currentTarget.releasePointerCapture(event.pointerId);
    onDrop(drag.sticker, event.clientX, event.clientY);
    setDrag(null);
  };

  /**
   * A cancelled pull places nothing. Tiles allow `pan-y`, so on a touch screen
   * a vertical swipe over one becomes a scroll of the shelf — the browser
   * takes the pointer and fires cancel, and dropping the sticker wherever the
   * finger happened to be would turn every scroll into a stray placement.
   */
  const cancelPull = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    event.stopPropagation();
    setDrag(null);
  };

  // --- uploads -------------------------------------------------------------
  const addFiles = async (files: FileList | null) => {
    if (!files?.length || busy) return;
    setBusy(true);
    setNote(null);

    try {
      const { added, skipped } = await onUpload(files);
      if (!added) {
        setNote("Could not read that. Try a PNG, JPG or WebP.");
      } else if (skipped) {
        setNote(`Added ${added}; skipped ${skipped} that were not images.`);
      }
    } catch {
      setNote("That did not work. Try again?");
    } finally {
      setBusy(false);
    }
  };

  const uploaded = new Set(uploads.map((sticker) => sticker.id));
  const all = [...uploads, ...STICKERS];
  const shelves: Sticker[][] = [];
  for (let i = 0; i < all.length; i += COLUMNS) {
    shelves.push(all.slice(i, i + COLUMNS));
  }

  return (
    <>
      <section
        aria-label="Stickers"
        onPointerDown={mobile ? undefined : startDrawerDrag}
        onPointerMove={mobile ? undefined : moveDrawer}
        onPointerUp={mobile ? undefined : endDrawerDrag}
        onPointerCancel={mobile ? undefined : endDrawerDrag}
        style={{
          ...(mobile ? sheetScaleVars(DRAWER_WIDTH) : panelScaleVars),
          ...panelStyle,
          width: s(DRAWER_WIDTH),
          padding: s(28),
          rowGap: s(16),
          fontFamily: bodyFont,
          maxHeight: mobile ? "60cqh" : undefined,
          bottom: mobile ? SHEET_BOTTOM : undefined,
          transform: mobile ? undefined : `translate(${offset.x}px, ${offset.y}px)`,
          touchAction: mobile ? undefined : "none",
        }}
        className={`absolute z-45 flex flex-col ${panelClass} ${
          mobile
            ? "left-1/2 -translate-x-1/2"
            : `left-[14%] top-[18%] ${
                movingDrawer ? "cursor-grabbing select-none" : "cursor-grab"
              }`
        }`}
      >
        <header className="flex items-center">
          <h2
            style={{
              fontFamily: displayFont,
              fontSize: s(28),
              lineHeight: s(32),
              fontWeight: 500,
            }}
            className="text-[#1e1e1e]"
          >
            Stickers
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close stickers"
            style={{ width: s(40), height: s(38) }}
            className="ml-auto flex cursor-pointer items-center justify-center transition-transform hover:scale-105 active:scale-95"
          >
            <Cross size={20} />
          </button>
        </header>

        {/* The stack of shelves */}
        <div
          style={{ maxHeight: s(360), rowGap: s(28) }}
          className="sticker-scroll flex min-h-0 flex-col overflow-x-hidden overflow-y-auto overscroll-contain pr-2"
        >
          {shelves.map((shelf, row) => (
            <div key={row} className="shrink-0">
              {/*
                Grid with 1fr columns rather than fixed-width tiles. The
                scrollbar eats width the drawer cannot predict — it is a fixed
                pixel size while everything else scales — so fixed tiles
                overflowed and clipped the fourth column. Flexible columns
                absorb whatever the scrollbar takes.
              */}
              <div
                style={{ columnGap: s(GAP), height: s(TILE) }}
                className="grid grid-cols-4 items-end"
              >
                {shelf.map((sticker) => (
                  <div key={sticker.id} className="group relative flex w-full">
                    <button
                      type="button"
                      data-tile
                      aria-label={`Drag ${sticker.id} onto the page`}
                      onPointerDown={(event) => startPull(event, sticker)}
                      onPointerMove={movePull}
                      onPointerUp={endPull}
                      onPointerCancel={cancelPull}
                      style={{ height: s(TILE), touchAction: "pan-y" }}
                      className="flex w-full cursor-grab items-end justify-center transition-transform hover:-translate-y-0.5 hover:scale-105 active:cursor-grabbing"
                    >
                      {/* Plain img: uploads are data: URLs, which next/image
                          cannot serve, and these are already optimised WebP. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sticker.src}
                        alt=""
                        loading="lazy"
                        draggable={false}
                        style={{ maxHeight: s(TILE) }}
                        className="pointer-events-none max-w-full object-contain"
                      />
                    </button>

                    {/* Only your own come off the shelf again — the bundled set
                        is the app's, and an upload you cannot undo is a shelf
                        that only ever fills up. */}
                    {uploaded.has(sticker.id) ? (
                      <button
                        type="button"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => onRemoveUpload(sticker.id)}
                        aria-label={`Remove ${sticker.id}`}
                        style={{ width: s(20), height: s(20), top: s(-4), right: s(-4) }}
                        className="absolute flex cursor-pointer items-center justify-center rounded-full bg-white/90 opacity-0 shadow-sm ring-1 ring-black/10 transition group-hover:opacity-100 hover:scale-110 focus-visible:opacity-100"
                      >
                        <Cross size={10} />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>

              {/* The shelf the row stands on */}
              <div
                style={{
                  height: s(7),
                  borderRadius: s(4),
                  background: "linear-gradient(#f0d3ab, #d3a266)",
                  boxShadow: `0 ${s(2)} ${s(3)} rgba(61,14,38,0.28)`,
                }}
              />
            </div>
          ))}
        </div>

        <div style={{ rowGap: s(6) }} className="flex shrink-0 flex-col">
          <label
            style={{
              height: s(36),
              borderRadius: s(12),
              fontSize: s(14),
              boxShadow: `0 ${s(1)} ${s(2.3)} rgba(0,0,0,0.25)`,
            }}
            className={`flex items-center justify-center border border-black/10 bg-white text-black transition-transform ${
              busy ? "cursor-wait opacity-70" : "cursor-pointer hover:scale-[1.02] active:scale-95"
            }`}
          >
            {busy ? "adding …" : "upload your own ...."}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              multiple
              disabled={busy}
              onChange={(event) => {
                void addFiles(event.target.files);
                // Cleared so picking the same file twice still fires a change.
                event.target.value = "";
              }}
              className="hidden"
            />
          </label>

          {note ? (
            <p
              style={{ fontSize: s(11), lineHeight: s(15), paddingInline: s(4) }}
              className="text-black/55"
            >
              {note}
            </p>
          ) : null}
        </div>
      </section>

      {/* Follows the pointer while a sticker is being pulled out. Fixed, so it
          is not clipped by the drawer's scroll container. */}
      {drag ? (
        <div
          style={{
            ...panelScaleVars,
            left: drag.x,
            top: drag.y,
            width: s(TILE),
            height: s(TILE),
          }}
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={drag.sticker.src}
            alt=""
            className="h-full w-full rotate-6 object-contain drop-shadow-lg"
          />
        </div>
      ) : null}
    </>
  );
}
