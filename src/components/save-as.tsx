"use client";

import Image from "next/image";
import { useState } from "react";

import saveAsLettering from "../../public/save as.png";
import tomato from "../../public/icons/tomato-icon.png";
import {
  download,
  renderCard,
  renderStory,
  toBlob,
  type CardArt,
} from "./card-export";
import {
  bodyFont,
  panelClass,
  panelScaleVars,
  panelStyle,
  s,
  scaleVars,
} from "./figma-scale";
import { sfx } from "./sounds";
import { STAR_SHAPES } from "./star-shapes";

/**
 * "Save as" — takes the board off the screen and gives it to the user.
 *
 * Two shapes, because they are for different things: the card on its own is the
 * keepsake, and the 1080x1920 version is sized for a story so nothing gets
 * cropped or letterboxed on the way in.
 *
 * On sharing to Instagram: a web page cannot post to a story. The
 * `instagram-stories://` scheme that does exist is for native apps registered
 * with Meta and does nothing from a browser, and there is no public web API for
 * it. What *does* work is the OS share sheet — `navigator.share` with a file —
 * where Instagram is one of the targets, and from there "Add to story" is one
 * more tap. That is a real two-tap path on a phone and it is what Share does
 * here. On a desktop browser, which has no share sheet for files, it falls back
 * to saving the file.
 */
type Job = "card" | "story" | "share" | null;

export default function SaveAs({
  art,
  name,
  className = "",
  style,
}: {
  /** Read at click time, so the export always matches the board as it is now. */
  art: () => CardArt;
  name?: string | null;
  className?: string;
  /** For offsets that need calc() — the portrait layout's toolbar anchor. */
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Job>(null);
  const [note, setNote] = useState<string | null>(null);

  const stamp = () => new Date().toISOString().slice(0, 10);

  const run = async (job: Exclude<Job, null>) => {
    if (busy) return;
    sfx.shutter();
    setBusy(job);
    setNote(null);

    try {
      const canvas =
        job === "card"
          ? await renderCard(art(), 2)
          : await renderStory(art(), name);
      const blob = await toBlob(canvas);
      const filename = `todobingo-${job === "card" ? "card" : "story"}-${stamp()}.png`;

      if (job === "share") {
        const file = new File([blob], filename, { type: "image/png" });
        // `canShare` is the only reliable test: several browsers define
        // `navigator.share` but reject files, and finding that out by catching
        // the rejection means the user has already tapped and waited.
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "My ToDoBingo card",
          });
          setOpen(false);
          return;
        }
        download(blob, filename);
        setNote("No share sheet here — saved it instead. Post it from your phone.");
        return;
      }

      download(blob, filename);
      setOpen(false);
    } catch (error) {
      // A cancelled share sheet rejects; that is not a failure worth reporting.
      if ((error as Error)?.name === "AbortError") return;
      setNote("That did not work. Try again?");
    } finally {
      setBusy(null);
    }
  };

  const item = (
    job: Exclude<Job, null>,
    title: string,
    detail: string,
  ) => (
    <button
      type="button"
      onClick={() => void run(job)}
      disabled={busy !== null}
      style={{
        paddingBlock: s(9),
        paddingInline: s(12),
        borderRadius: s(10),
        rowGap: s(1),
      }}
      className="flex cursor-pointer flex-col items-start text-left transition hover:bg-white/55 disabled:cursor-wait disabled:opacity-60"
    >
      <span style={{ fontSize: s(15), lineHeight: s(19) }} className="text-[#1e1e1e]">
        {busy === job ? "Working…" : title}
      </span>
      <span style={{ fontSize: s(11), lineHeight: s(14) }} className="text-black/45">
        {detail}
      </span>
    </button>
  );

  const spark = STAR_SHAPES[2];

  return (
    <div style={{ ...scaleVars, ...style }} className={`absolute ${className}`}>
      <button
        type="button"
        onClick={() => {
          setOpen((was) => !was);
          setNote(null);
        }}
        aria-label="Save as"
        aria-expanded={open}
        style={{ columnGap: s(8), padding: s(4) }}
        className="flex cursor-pointer items-center transition-transform hover:scale-105 active:scale-95"
      >
        <Image
          src={tomato}
          alt=""
          style={{ width: s(44), height: s(44) }}
          className="max-w-none select-none"
        />
        <span className="relative flex items-center">
          <Image
            src={saveAsLettering}
            alt="Save as"
            style={{ width: s(120), height: s(34) }}
            className="max-w-none select-none"
          />
          {/* The little star tucked under the lettering, as in the design. */}
          <svg
            viewBox={spark.viewBox}
            fill="none"
            aria-hidden
            style={{ width: s(30), height: s(30), right: s(-12), bottom: s(-9) }}
            className="pointer-events-none absolute"
          >
            <path d={spark.fill} fill={spark.fillColor} />
            <path
              d={spark.outline}
              stroke={spark.stroke}
              strokeWidth={spark.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {/*
        Opens upward. The button lives under the card, which is already close to
        the bottom of the notepad — dropping the menu down puts it off the page,
        where it cannot be read let alone clicked.
      */}
      {open ? (
        <div
          style={{
            ...panelScaleVars,
            ...panelStyle,
            width: s(250),
            borderRadius: s(16),
            padding: s(8),
            rowGap: s(2),
            marginBottom: s(8),
            fontFamily: bodyFont,
          }}
          className={`absolute bottom-full right-0 z-50 flex flex-col ${panelClass}`}
        >
          {item("card", "Download card", "PNG, 1290 × 1606")}
          {item("story", "Download for a story", "1080 × 1920, ready to post")}
          {item("share", "Share…", "Opens Instagram and the rest")}

          {note ? (
            <p
              style={{
                fontSize: s(11),
                lineHeight: s(15),
                paddingInline: s(12),
                paddingBottom: s(6),
              }}
              className="text-black/55"
            >
              {note}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
