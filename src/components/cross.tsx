import { s } from "./figma-scale";

/** Ink colour for the drawn marks — the same dark plum as the task bullets. */
export const INK = "#3d0e26";

/**
 * The one cross used everywhere — closing a popup, deleting a task, removing a
 * placed sticker. Drawn rather than set in a typeface, since neither Cheri
 * Liney nor The Wildeast is available. The strokes are deliberately off-square
 * so it reads hand-made, and because the viewBox is fixed the weight scales
 * with the size.
 */
export default function Cross({
  size,
  color = INK,
}: {
  size: number;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      style={{ width: s(size), height: s(size) }}
    >
      <path
        d="M3.7 3.1 12.4 12.9"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M12.7 3.5 3.3 12.5"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
