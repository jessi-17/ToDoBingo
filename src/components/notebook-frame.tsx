import type { ReactNode } from "react";

import { FRAME_TOP } from "./figma-scale";

/**
 * The notepad, drawn as a nine-slice of the artwork rather than as one fixed
 * picture.
 *
 * Shown whole with `object-contain`, the art is locked to its own 2:1 shape:
 * the page can only ever be that wide-and-short, and the red frame thickens and
 * thins with it. Slicing it means the corners stay crisp, the edges tile, and
 * the paper in the middle grows to whatever space there is — so the frame's
 * weight and the page's proportions become independent of each other.
 *
 * The source is hero-frame.png: the original cropped to the red frame's own
 * bounds. The artwork carries a pink margin outside the red, which left a gap
 * at the top of the window no amount of removing padding could close — the gap
 * was inside the picture. Slices below are measured on the cropped file.
 */
const SLICE = { top: 370, right: 111, bottom: 190, left: 116 };

/**
 * Rendered band thickness. Deliberately thinner than the artwork's natural
 * proportions — the frame was eating the page. The top keeps more of its depth
 * than the sides because the binding rings live in it and squash if it is cut
 * too far.
 *
 * Each band is clamped against the other axis for portrait screens: bands cut
 * from viewport height alone would eat a third of a phone's width, and the
 * side bands cut from width alone would vanish entirely.
 */
const BAND = {
  top: FRAME_TOP,
  side: "max(2.3vw, 9px)",
  bottom: "min(6.5vh, 10vw)",
};

const NotebookFrame = ({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={`h-full w-full ${className}`}
    >
      <div
        style={{
          borderImageSource: "url(/hero-frame.png)",
          borderImageSlice: `${SLICE.top} ${SLICE.right} ${SLICE.bottom} ${SLICE.left} fill`,
          borderImageWidth: `${BAND.top} ${BAND.side} ${BAND.bottom}`,
          // Rings tile across the top; the plain side bands just stretch.
          borderImageRepeat: "round stretch",
        }}
        className="relative h-full w-full [container-type:size]"
      >
        {children}
      </div>
    </div>
  );
};

export default NotebookFrame;
