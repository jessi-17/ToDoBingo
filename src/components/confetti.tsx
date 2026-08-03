"use client";

/**
 * A full-page confetti burst. Mount it with a changing `key` to replay it.
 *
 * Every piece gets its own size, colour, drift, spin, fall time and flutter
 * rate. Sharing any of those across pieces makes the whole thing drop as one
 * sheet, which is what makes cheap confetti look cheap.
 */
const COLORS = [
  "#fff68d",
  "#f6aff2",
  "#93d1fc",
  "#dff380",
  "#e50285",
  "#9d3124",
  "#7b9115",
  "#ffffff",
];

/**
 * Deterministic pseudo-random from an index. Keeps the burst identical between
 * the server render and hydration — Math.random() here would mismatch.
 */
const noise = (seed: number, salt: number) => {
  const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

/**
 * `pieces` sizes the burst to the size of the win. Ticking one task off is
 * worth a handful; a bingo line is worth the whole page. The `salt` shifts
 * every piece's parameters, so two bursts in a row do not fall identically.
 */
export default function Confetti({
  pieces = 120,
  salt = 0,
}: {
  pieces?: number;
  salt?: number;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-50 overflow-hidden"
    >
      {Array.from({ length: pieces }, (_, index) => {
        const i = index + salt * 37;
        const width = 7 + noise(i, 1) * 11;
        const height = 10 + noise(i, 2) * 16;
        const round = noise(i, 6) > 0.82;

        return (
          <span
            key={index}
            style={{
              left: `${noise(i, 3) * 100}%`,
              width,
              height: round ? width : height,
              ["--drift" as string]: `${(noise(i, 4) - 0.5) * 340}px`,
              ["--spin" as string]: `${(noise(i, 5) - 0.5) * 1800}deg`,
              ["--fall" as string]: `${4.4 + noise(i, 7) * 3.2}s`,
              ["--delay" as string]: `${noise(i, 8) * 1800}ms`,
            }}
            className="confetti absolute top-0 block"
          >
            <span
              style={{
                backgroundColor: COLORS[i % COLORS.length],
                borderRadius: round ? "50%" : 2,
                ["--flutter" as string]: `${420 + noise(i, 9) * 700}ms`,
              }}
              className="confetti-face"
            />
          </span>
        );
      })}
    </div>
  );
}
