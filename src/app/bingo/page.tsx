"use client";

import BingoCard from "@/components/bingo-card";

/**
 * The bingo card on its own, sized to whatever space the window gives it.
 *
 * `--bu` is one design pixel: the smaller of the horizontal and vertical fits,
 * so the 645x803 card always lands whole and keeps its proportions. Everything
 * inside is written in the design's own numbers and multiplies up from here.
 */
export default function BingoPage() {
  // Placeholder squares; on the notepad these are filled by dragging tasks in.
  // Static here — this page is for looking at the card, not working on it.
  const cells = Array.from({ length: 25 }, (_, i) => ({
    label: `This is the task ${i + 1}`,
    done: false,
  }));

  return (
    <main className="h-dvh bg-[#f79bec] p-[2vmin]">
      <div className="h-full w-full [container-type:size]">
        <div
          style={{
            // 0.97 keeps a little air around the card rather than letting it
            // touch the edges of the window.
            ["--bu" as string]:
              "min(97cqw / 645, 97cqh / 803)",
          }}
          className="grid h-full w-full place-items-center"
        >
          <BingoCard cells={cells} />
        </div>
      </div>
    </main>
  );
}
