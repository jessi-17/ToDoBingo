"use client";

import { CARD_THEMES, cardTheme, type ThemeId } from "./card-themes";
import { s } from "./figma-scale";

/**
 * The two ways to change the card's colourway: a one-tap shuffle that lives on
 * the card itself, and a picker in the profile for choosing one on purpose.
 */

/**
 * Tucked into the card's empty top-right corner, beside the 2026 sticker.
 * Sized in the card's own units so it scales with the card, with a floor so
 * it is still a fair touch target on a phone, where the card is at its
 * smallest.
 */
export function ThemeShuffle({ onShuffle }: { onShuffle: () => void }) {
  const u = (n: number) => `calc(${n} * var(--bu, 1px))`;
  const size = `max(28px, ${u(40)})`;

  return (
    <button
      type="button"
      onClick={onShuffle}
      aria-label="Shuffle card colours"
      title="Shuffle card colours"
      style={{
        right: u(6),
        top: u(18),
        width: size,
        height: size,
        borderWidth: "max(1px, calc(1 * var(--bu, 1px)))",
        boxShadow: `0 ${u(2)} ${u(5)} rgba(0,0,0,0.22)`,
      }}
      className="group absolute z-30 flex cursor-pointer items-center justify-center rounded-full border-black bg-white/90 transition hover:scale-110 hover:bg-white active:scale-90"
    >
      {/* A die: at this size the usual crossed arrows read as "expand". */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className="h-[62%] w-[62%] transition-transform duration-300 group-hover:rotate-90"
      >
        <rect
          x="3.5"
          y="3.5"
          width="17"
          height="17"
          rx="4"
          stroke="#1e1e1e"
          strokeWidth={2}
        />
        {[
          [8.5, 8.5],
          [15.5, 8.5],
          [12, 12],
          [8.5, 15.5],
          [15.5, 15.5],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.6} fill="#1e1e1e" />
        ))}
      </svg>
    </button>
  );
}

/** A thumbnail of the card in one colourway: body, BINGO strip, grid panel. */
function Swatch({ id }: { id: ThemeId }) {
  const theme = cardTheme(id);
  return (
    <span
      aria-hidden
      style={{
        width: s(54),
        height: s(66),
        borderRadius: s(6),
        padding: s(6),
        rowGap: s(3),
        backgroundColor: theme.card,
      }}
      className="flex flex-col border border-black/60"
    >
      <span
        style={{
          height: s(9),
          borderRadius: `${s(3)} ${s(3)} 0 0`,
          backgroundColor: theme.tile,
        }}
        className="block border border-black/60"
      />
      <span
        style={{ borderRadius: s(3), backgroundColor: theme.panel }}
        className="block flex-1 border border-black/60"
      />
    </span>
  );
}

export function ThemePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: ThemeId) => void;
}) {
  return (
    <div style={{ rowGap: s(6) }} className="flex flex-col">
      <span style={{ fontSize: s(12) }} className="text-black/50">
        Card style
      </span>
      <div
        role="radiogroup"
        aria-label="Card style"
        style={{ columnGap: s(8) }}
        className="flex"
      >
        {CARD_THEMES.map((theme) => {
          const active = cardTheme(value).id === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(theme.id)}
              style={{
                paddingBlock: s(8),
                borderRadius: s(12),
                rowGap: s(5),
              }}
              className={`flex flex-1 cursor-pointer flex-col items-center transition ${
                active
                  ? "bg-white/85 ring-2 ring-[#9d3124]"
                  : "bg-white/45 hover:bg-white/70"
              }`}
            >
              <Swatch id={theme.id} />
              <span
                style={{ fontSize: s(10), lineHeight: s(12) }}
                className="text-center text-[#3d0e26]"
              >
                {theme.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
