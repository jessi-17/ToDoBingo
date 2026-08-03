import { STAR_PATHS } from "./wordmark-star-paths";

/**
 * The wordmark's sparkles, reused as loose page decoration.
 *
 * Each entry keeps the path data exactly as authored and simply carries the
 * viewBox that frames it, so nothing has to be re-projected: the blue and pink
 * are still in the wordmark's 515x171 space, the star is in its own 47x45 one.
 * The purple is the star shape in a different colourway.
 */
export type StarShape = {
  id: string;
  viewBox: string;
  fill: string;
  outline: string;
  fillColor: string;
  stroke: string;
  strokeWidth: number;
};

export const STAR_SHAPES: StarShape[] = [
  {
    id: "blue",
    viewBox: "64 34 36 39",
    fill: STAR_PATHS.blue.fill,
    outline: STAR_PATHS.blue.outline,
    fillColor: STAR_PATHS.blue.fillColor,
    stroke: STAR_PATHS.blue.stroke,
    strokeWidth: STAR_PATHS.blue.strokeWidth,
  },
  {
    id: "pink",
    viewBox: "237 101 38 38",
    fill: STAR_PATHS.pink.fill,
    outline: STAR_PATHS.pink.outline,
    fillColor: STAR_PATHS.pink.fillColor,
    stroke: STAR_PATHS.pink.stroke,
    strokeWidth: STAR_PATHS.pink.strokeWidth,
  },
  {
    id: "green",
    viewBox: "0 0 47 45",
    fill: STAR_PATHS.green.fill,
    outline: STAR_PATHS.green.outline,
    fillColor: STAR_PATHS.green.fillColor,
    stroke: STAR_PATHS.green.stroke,
    strokeWidth: STAR_PATHS.green.strokeWidth,
  },
  {
    id: "purple",
    viewBox: "0 0 47 45",
    fill: STAR_PATHS.green.fill,
    outline: STAR_PATHS.green.outline,
    fillColor: "#c6b6ff",
    stroke: "#6a4fd0",
    strokeWidth: 3,
  },
];
