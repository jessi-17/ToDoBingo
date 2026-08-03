"use client";

import { useState } from "react";

import {
  bodyFont,
  displayFont,
  panelClass,
  panelStyle,
  s,
  scaleVars,
} from "./figma-scale";
import NameBeads, { MAX_NAME } from "./name-beads";

/**
 * Asked once, on a visitor's first arrival. Whatever they type is previewed
 * live in the letter beads below the field, so the name they confirm is the
 * one they have already seen spelled out.
 */
export default function NamePrompt({
  onConfirm,
}: {
  onConfirm: (name: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const name = draft.trim();

  const submit = () => {
    if (!name) return;
    onConfirm(name.toUpperCase());
  };

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/25 backdrop-blur-[2px]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        style={{
          ...scaleVars,
          ...panelStyle,
          width: s(520),
          // The artboard scale is taken from the container's height, which on
          // a portrait phone is more than the width can hold.
          maxWidth: "94cqw",
          padding: s(38),
          rowGap: s(20),
          fontFamily: bodyFont,
        }}
        className={`flex flex-col items-center text-center ${panelClass}`}
      >
        <h2
          style={{
            fontFamily: displayFont,
            fontSize: s(38),
            lineHeight: s(44),
            fontWeight: 500,
          }}
          className="text-[#1e1e1e]"
        >
          What should we call you?
        </h2>

        <input
          autoFocus
          value={draft}
          // Beads only exist for A–Z, so anything else is dropped as it is
          // typed rather than silently vanishing from the preview later.
          onChange={(event) =>
            setDraft(
              event.target.value
                .replace(/[^a-zA-Z]/g, "")
                .slice(0, MAX_NAME)
                .toUpperCase(),
            )
          }
          maxLength={MAX_NAME}
          placeholder="your name"
          aria-label="Your name"
          style={{
            height: s(52),
            width: s(300),
            borderRadius: s(12),
            fontSize: s(22),
            letterSpacing: s(4),
            boxShadow: `0 ${s(1)} ${s(2.3)} rgba(0,0,0,0.25)`,
          }}
          className="border border-black/10 bg-white text-center uppercase text-black placeholder:normal-case placeholder:tracking-normal placeholder:text-black/35 focus:outline-none"
        />

        {/* Live preview in the beads */}
        <div
          style={{ minHeight: s(56) }}
          className="flex items-center justify-center"
        >
          {name ? (
            <NameBeads name={name} size={48} gap={5} />
          ) : (
            <span
              style={{ fontSize: s(13) }}
              className="text-black/40"
            >
              up to {MAX_NAME} letters — we&rsquo;ll spell it in beads
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={!name}
          style={{
            height: s(46),
            paddingInline: s(38),
            borderRadius: s(14),
            fontSize: s(17),
            borderWidth: s(2),
          }}
          className="cursor-pointer border-[#9d3124] bg-[#fff68d] text-[#3d0e26] transition-transform hover:scale-105 active:scale-95 disabled:cursor-default disabled:opacity-40 disabled:hover:scale-100"
        >
          That&rsquo;s me
        </button>
      </form>
    </div>
  );
}
