/**
 * A name spelled out in the letter beads from the sticker set.
 *
 * A–Z map onto image-69 … image-94 in order; verified against the rendered
 * sheet rather than assumed. Anything outside A–Z is skipped.
 */
import { s } from "./figma-scale";
import { sfx } from "./sounds";

const FIRST_BEAD = 69;
const A = "A".charCodeAt(0);

export const MAX_NAME = 8;

export const beadFor = (letter: string) => {
  const index = letter.toUpperCase().charCodeAt(0) - A;
  if (index < 0 || index > 25) return null;
  return `/stickers/image-${FIRST_BEAD + index}.webp`;
};

export default function NameBeads({
  name,
  size,
  gap = 4,
  className = "",
}: {
  name: string;
  /** Bead size in artboard units. */
  size: number;
  gap?: number;
  className?: string;
}) {
  const beads = name
    .split("")
    .map((letter, i) => ({ letter, src: beadFor(letter), i }))
    .filter((bead) => bead.src);

  return (
    <div
      style={{ columnGap: s(gap) }}
      className={`flex items-center ${className}`}
    >
      {beads.map((bead) => (
        // Beads are photographs of real letters, so they carry a slight
        // alternating tilt — a perfectly level row reads as a font, not beads.
        // Clicking one clacks it: each position has its own pitch, so a name
        // is also a little instrument.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${bead.letter}-${bead.i}`}
          src={bead.src as string}
          alt={bead.letter.toUpperCase()}
          draggable={false}
          onClick={() => sfx.bead(bead.i)}
          style={{
            width: s(size),
            height: s(size),
            rotate: `${((bead.i % 3) - 1) * 4}deg`,
          }}
          className="max-w-none cursor-pointer select-none object-contain transition-transform active:scale-90"
        />
      ))}
    </div>
  );
}
