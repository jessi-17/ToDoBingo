"use client";

import { useState } from "react";

import Cross from "./cross";
import {
  bodyFont,
  displayFont,
  panelClass,
  panelScaleVars,
  panelStyle,
  s,
} from "./figma-scale";
import { noteFont, NOTE_FONTS, type NoteFontId } from "./note-fonts";

/**
 * Quote — somewhere to find a line, and three ways to get it onto the card.
 *
 * Deliberately not a screen you read and leave. The card already has two
 * heading slots designed for exactly this kind of sentence, and text notes with
 * their own faces already drop into squares, so everything here ends by handing
 * the line to one of those. A panel that only displayed a nice quote would be
 * decoration; this one is a source for the card.
 */
const HEART = "M8 14s-5.5-3.6-5.5-7A3.2 3.2 0 0 1 8 5.4 3.2 3.2 0 0 1 13.5 7c0 3.4-5.5 7-5.5 7Z";

export default function QuotePanel({
  quote,
  favourites,
  font,
  onFont,
  onShuffle,
  onPick,
  onToggleFavourite,
  onUseAsTitle,
  onUseAsFooter,
  onDropOnPage,
  onClose,
  className = "",
}: {
  quote: string;
  favourites: string[];
  font: NoteFontId;
  onFont: (font: NoteFontId) => void;
  onShuffle: () => void;
  onPick: (quote: string) => void;
  onToggleFavourite: (quote: string) => void;
  onUseAsTitle: (quote: string) => void;
  onUseAsFooter: (quote: string) => void;
  onDropOnPage: (quote: string) => void;
  onClose: () => void;
  className?: string;
}) {
  const face = noteFont(font);
  const [draft, setDraft] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const saved = favourites.includes(quote);

  /** Says what happened, then gets out of the way. */
  const flash = (message: string) => {
    setDone(message);
    setTimeout(() => setDone(null), 2200);
  };

  const write = () => {
    const text = draft.trim();
    if (!text) return;
    onPick(text);
    // Your own line is kept without asking; there is nowhere else it lives.
    if (!favourites.includes(text)) onToggleFavourite(text);
    setDraft("");
  };

  const action = (label: string, run: () => void, message: string) => (
    <button
      type="button"
      onClick={() => {
        run();
        flash(message);
      }}
      style={{
        height: s(44),
        borderRadius: s(12),
        fontSize: s(14),
        boxShadow: `0 ${s(1)} ${s(2.3)} rgba(0,0,0,0.2)`,
      }}
      className="flex flex-1 cursor-pointer items-center justify-center border border-black/12 bg-white/75 text-[#3d0e26] transition hover:bg-white active:scale-95"
    >
      {label}
    </button>
  );

  return (
    <section
      aria-label="Quote"
      style={{
        ...panelScaleVars,
        ...panelStyle,
        width: s(486),
        padding: s(34),
        rowGap: s(22),
        fontFamily: bodyFont,
      }}
      className={`absolute z-45 flex flex-col ${panelClass} ${className}`}
    >
      <header className="flex items-center">
        <h2
          style={{
            fontFamily: displayFont,
            fontSize: s(32),
            lineHeight: s(37),
            fontWeight: 500,
          }}
          className="text-[#1e1e1e]"
        >
          Quote
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close quote"
          style={{ width: s(44), height: s(42) }}
          className="ml-auto flex cursor-pointer items-center justify-center transition-transform hover:scale-105 active:scale-95"
        >
          <Cross size={22} />
        </button>
      </header>

      {/* The line itself, set in the face it would be dropped in. */}
      <div
        style={{
          minHeight: s(132),
          padding: s(24),
          borderRadius: s(18),
        }}
        className="flex items-center justify-center bg-white/45"
      >
        <p
          style={{
            fontFamily: face.family,
            // The per-face multiplier keeps every one reading at the same
            // weight; without it Script comes out twice the size of Round.
            fontSize: s(34 * face.scale),
            lineHeight: s(42 * face.scale),
          }}
          className="text-center text-[#3d0e26]"
        >
          {quote}
        </p>
      </div>

      {/*
        The preview *is* the picker's result: choose a face and the line above
        redraws in it, so what you see is exactly what "Drop it" will lay down.
        Each tile writes its own name, the same way the text tool's does.
      */}
      <div style={{ gap: s(8) }} className="flex flex-wrap">
        {NOTE_FONTS.map((option) => {
          const on = font === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onFont(option.id)}
              aria-pressed={on}
              title={option.label}
              style={{
                height: s(38),
                paddingInline: s(14),
                borderRadius: s(10),
                borderWidth: s(on ? 2.5 : 1),
                fontFamily: option.family,
                fontSize: s(17 * option.scale),
                boxShadow: `0 ${s(1)} ${s(2)} rgba(0,0,0,0.18)`,
              }}
              className={`flex cursor-pointer items-center justify-center leading-none transition ${
                on
                  ? "border-[#9d3124] bg-[#fff68d] text-[#3d0e26]"
                  : "border-black/10 bg-white/70 text-[#1e1e1e] hover:bg-white"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div style={{ columnGap: s(10) }} className="flex items-center">
        <button
          type="button"
          onClick={() => onToggleFavourite(quote)}
          aria-label={saved ? "Remove from saved" : "Save this quote"}
          aria-pressed={saved}
          style={{ width: s(48), height: s(42), borderRadius: s(12) }}
          className="flex shrink-0 cursor-pointer items-center justify-center border border-black/12 bg-white/75 transition hover:bg-white active:scale-95"
        >
          <svg viewBox="0 0 16 16" style={{ width: s(21) }} aria-hidden>
            <path
              d={HEART}
              fill={saved ? "#e50285" : "none"}
              stroke={saved ? "#e50285" : "#3d0e26"}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <button
          type="button"
          onClick={onShuffle}
          style={{ height: s(42), borderRadius: s(12), fontSize: s(16), columnGap: s(8) }}
          className="flex flex-1 cursor-pointer items-center justify-center border border-[#9d3124]/35 bg-[#fff68d] text-[#3d0e26] transition hover:scale-[1.02] active:scale-95"
        >
          <svg viewBox="0 0 16 16" fill="none" style={{ width: s(17) }} aria-hidden>
            <path
              d="M2 4h3l6 8h3M2 12h3l6-8h3M12 2l2 2-2 2M12 10l2 2-2 2"
              stroke="#3d0e26"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Shuffle
        </button>
      </div>

      <div style={{ columnGap: s(8) }} className="flex">
        {/*
          The two headings are printed parts of the card and keep the card's own
          face — the picker above sets what gets *dropped*, not how the card is
          typeset. Said out loud here, because picking Poster and then pressing
          "Use as title" is otherwise a small surprise.
        */}
        {action(
          "Use as title",
          () => onUseAsTitle(quote),
          "At the top of the card, in the card's own face",
        )}
        {action(
          "Use as footer",
          () => onUseAsFooter(quote),
          "At the foot of the card, in the card's own face",
        )}
        {action("Drop it", () => onDropOnPage(quote), "Dropped on the page — drag it where you want")}
      </div>

      {/* Write your own */}
      <div style={{ columnGap: s(10) }} className="flex items-center">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, 60))}
          onKeyDown={(event) => event.key === "Enter" && write()}
          placeholder="or write your own ...."
          maxLength={60}
          style={{
            height: s(46),
            borderRadius: s(12),
            paddingInline: s(16),
            fontSize: s(16),
            boxShadow: `0 ${s(1)} ${s(2.3)} rgba(0,0,0,0.22)`,
          }}
          className="min-w-0 flex-1 border border-black/10 bg-white text-black placeholder:text-black/45 focus:outline-none focus:ring-1 focus:ring-[#9d3124]"
        />
        <button
          type="button"
          onClick={write}
          disabled={!draft.trim()}
          aria-label="Use this line"
          style={{ height: s(46), paddingInline: s(18), borderRadius: s(12), fontSize: s(15) }}
          className="shrink-0 cursor-pointer border border-black/12 bg-white/75 text-[#3d0e26] transition hover:bg-white disabled:cursor-default disabled:opacity-40"
        >
          Use
        </button>
      </div>

      {favourites.length ? (
        <div style={{ rowGap: s(8) }} className="flex min-h-0 flex-col">
          <span style={{ fontSize: s(14) }} className="text-black/50">
            Saved
          </span>
          <div
            style={{ maxHeight: s(158), rowGap: s(5) }}
            className="sticker-scroll flex flex-col overflow-y-auto overscroll-contain pr-2"
          >
            {favourites.map((favourite) => (
              <div
                key={favourite}
                style={{ columnGap: s(6), borderRadius: s(10) }}
                className="flex shrink-0 items-center hover:bg-white/45"
              >
                <button
                  type="button"
                  onClick={() => onPick(favourite)}
                  style={{
                    fontSize: s(15),
                    lineHeight: s(20),
                    paddingBlock: s(7),
                    paddingInline: s(11),
                  }}
                  className="min-w-0 flex-1 cursor-pointer truncate text-left text-[#1e1e1e]"
                >
                  {favourite}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleFavourite(favourite)}
                  aria-label={`Remove ${favourite}`}
                  style={{ width: s(26), height: s(26) }}
                  className="flex shrink-0 cursor-pointer items-center justify-center rounded transition hover:bg-black/10"
                >
                  <Cross size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {done ? (
        <p style={{ fontSize: s(13), lineHeight: s(17) }} className="text-black/55">
          {done}
        </p>
      ) : null}
    </section>
  );
}
