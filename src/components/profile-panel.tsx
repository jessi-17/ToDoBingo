"use client";

import { useState } from "react";

import { useSaveState, type ArchivedCard } from "./board-store";
import Cross from "./cross";
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
import { setMuted, sfx, useMuted } from "./sounds";

/**
 * Profile — who you are, how you are doing, and the cards you have finished.
 *
 * The panel exists mostly because the work behind it does: everything on the
 * page is now written to storage, and this is where that becomes visible and
 * controllable. Without it, saving is invisible and there is no way to change
 * the name you typed once on your first visit or to start a second card.
 */
const stat = (label: string, value: number | string) => (
  <div
    key={label}
    style={{ paddingBlock: s(10), borderRadius: s(12), rowGap: s(1) }}
    className="flex flex-1 flex-col items-center bg-white/45"
  >
    <span
      style={{ fontSize: s(24), lineHeight: s(28) }}
      className="tabular-nums text-[#1e1e1e]"
    >
      {value}
    </span>
    <span
      style={{ fontSize: s(10), lineHeight: s(13) }}
      className="uppercase tracking-[0.12em] text-black/45"
    >
      {label}
    </span>
  </div>
);

export default function ProfilePanel({
  name,
  onRename,
  stats,
  archive,
  canFinish,
  onFinish,
  onOpen,
  onDownload,
  onDelete,
  onClose,
  className = "",
  mobile = false,
}: {
  name: string | null | undefined;
  onRename: (next: string) => void;
  stats: { tasksDone: number; lines: number; filled: number; finished: number };
  archive: ArchivedCard[];
  /** False when the current card is blank — nothing to put away. */
  canFinish: boolean;
  onFinish: () => Promise<void> | void;
  onOpen: (id: string) => void;
  onDownload: (id: string) => Promise<void> | void;
  onDelete: (id: string) => void;
  onClose: () => void;
  className?: string;
  /** Bottom sheet on the portrait layout, scrolling as one piece. */
  mobile?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = useSaveState();
  const muted = useMuted();

  const commit = () => {
    const next = (draft ?? "").trim().slice(0, 12);
    if (next) onRename(next);
    setDraft(null);
  };

  const run = async (job: () => Promise<void> | void) => {
    if (busy) return;
    setBusy(true);
    try {
      await job();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label="Profile"
      style={{
        ...(mobile ? sheetScaleVars(400) : panelScaleVars),
        ...panelStyle,
        width: s(400),
        padding: s(26),
        rowGap: s(16),
        fontFamily: bodyFont,
        maxHeight: mobile ? "60cqh" : undefined,
        bottom: mobile ? SHEET_BOTTOM : undefined,
      }}
      className={`absolute z-45 flex flex-col ${
        mobile ? "sticker-scroll overflow-y-auto overscroll-contain" : ""
      } ${panelClass} ${className}`}
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
          Profile
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close profile"
          style={{ width: s(38), height: s(36) }}
          className="ml-auto flex cursor-pointer items-center justify-center transition-transform hover:scale-105 active:scale-95"
        >
          <Cross size={19} />
        </button>
      </header>

      {/* Name. Editable here because the first-visit prompt only ever asks
          once — before this there was no way back from a typo. */}
      <div style={{ rowGap: s(6) }} className="flex flex-col">
        <span style={{ fontSize: s(12) }} className="text-black/50">
          Your name
        </span>
        <input
          value={draft ?? name ?? ""}
          onChange={(event) => setDraft(event.target.value.slice(0, 12))}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") setDraft(null);
          }}
          aria-label="Your name"
          maxLength={12}
          spellCheck={false}
          style={{
            height: s(40),
            borderRadius: s(10),
            paddingInline: s(12),
            fontSize: s(16),
            boxShadow: `0 ${s(1)} ${s(2.3)} rgba(0,0,0,0.2)`,
          }}
          className="border border-black/10 bg-white uppercase tracking-[0.14em] text-black focus:outline-none focus:ring-1 focus:ring-[#9d3124]"
        />
      </div>

      <div style={{ columnGap: s(8) }} className="flex">
        {stat("done", stats.tasksDone)}
        {stat("lines", stats.lines)}
        {stat("filled", `${stats.filled}/25`)}
        {stat("cards", stats.finished)}
      </div>

      <button
        type="button"
        onClick={() => void run(onFinish)}
        disabled={!canFinish || busy}
        style={{
          height: s(40),
          borderRadius: s(12),
          fontSize: s(14),
          boxShadow: `0 ${s(1)} ${s(2.3)} rgba(0,0,0,0.22)`,
        }}
        className="flex cursor-pointer items-center justify-center border border-[#9d3124]/40 bg-[#fff68d] text-[#3d0e26] transition hover:scale-[1.02] active:scale-95 disabled:cursor-default disabled:opacity-45 disabled:hover:scale-100"
      >
        {busy ? "Putting it away…" : "Finish this card & start a new one"}
      </button>

      {archive.length ? (
        <div style={{ rowGap: s(8) }} className="flex min-h-0 flex-col">
          <span style={{ fontSize: s(12) }} className="text-black/50">
            Your cards
          </span>
          <div
            style={{ maxHeight: s(230), rowGap: s(8) }}
            className="sticker-scroll flex flex-col overflow-y-auto overscroll-contain pr-2"
          >
            {archive.map((card) => (
              <div
                key={card.id}
                style={{ columnGap: s(10), padding: s(8), borderRadius: s(12) }}
                className="flex shrink-0 items-center bg-white/45"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={card.thumb}
                  alt=""
                  style={{ width: s(46), borderRadius: s(4) }}
                  className="shrink-0 shadow-sm"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span
                    style={{ fontSize: s(13), lineHeight: s(17) }}
                    className="truncate text-[#1e1e1e]"
                  >
                    {card.title || "Untitled card"}
                  </span>
                  <span
                    style={{ fontSize: s(11), lineHeight: s(14) }}
                    className="text-black/45"
                  >
                    {new Date(card.savedAt).toLocaleDateString()}
                  </span>
                </div>

                <div style={{ columnGap: s(4) }} className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => onOpen(card.id)}
                    style={{
                      height: s(26),
                      paddingInline: s(10),
                      borderRadius: s(8),
                      fontSize: s(11),
                    }}
                    className="cursor-pointer border border-black/15 bg-white/80 text-[#3d0e26] transition hover:bg-white"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => void run(() => onDownload(card.id))}
                    aria-label={`Download ${card.title || "card"}`}
                    title="Download"
                    style={{ width: s(26), height: s(26), borderRadius: s(8) }}
                    className="flex cursor-pointer items-center justify-center border border-black/15 bg-white/80 transition hover:bg-white"
                  >
                    <svg viewBox="0 0 16 16" fill="none" style={{ width: s(13) }} aria-hidden>
                      <path
                        d="M8 2v8M4.5 7L8 10.5 11.5 7M3 13h10"
                        stroke="#3d0e26"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(card.id)}
                    aria-label={`Delete ${card.title || "card"}`}
                    title="Delete"
                    style={{ width: s(26), height: s(26), borderRadius: s(8) }}
                    className="flex cursor-pointer items-center justify-center transition hover:bg-black/10"
                  >
                    <Cross size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Every interaction on the page makes a sound; this is the off switch. */}
      <button
        type="button"
        onClick={() => {
          const next = !muted;
          setMuted(next);
          // Turning sound back on answers with the sound itself.
          if (!next) sfx.sparkle(3);
        }}
        aria-pressed={!muted}
        style={{
          height: s(32),
          borderRadius: s(10),
          fontSize: s(12),
          columnGap: s(8),
          paddingInline: s(10),
        }}
        className="flex cursor-pointer items-center self-start border border-black/15 bg-white/70 text-[#3d0e26] transition hover:bg-white"
      >
        <svg viewBox="0 0 16 16" fill="none" style={{ width: s(14) }} aria-hidden>
          <path
            d="M2 6h2.5L8 3v10L4.5 10H2z"
            fill="#3d0e26"
            stroke="#3d0e26"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          {muted ? (
            <path
              d="M10.5 6l4 4m0-4l-4 4"
              stroke="#9d3124"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M10.5 5.5a3.5 3.5 0 010 5M12 3.5a6 6 0 010 9"
              stroke="#3d0e26"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          )}
        </svg>
        {muted ? "Sounds are off" : "Sounds are on"}
      </button>

      {/*
        Saving is silent and automatic, which is right — but silent also means
        indistinguishable from broken. This is the only place it is visible, and
        the only place a full-storage failure can be reported.
      */}
      <p
        style={{ fontSize: s(11), lineHeight: s(15) }}
        className={save.error ? "text-[#9d3124]" : "text-black/40"}
      >
        {save.error
          ? save.error
          : save.at
            ? `Saved at ${new Date(save.at).toLocaleTimeString()} — this browser only.`
            : "Your board saves itself as you go, in this browser."}
      </p>
    </section>
  );
}
