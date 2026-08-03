"use client";

import { useSyncExternalStore } from "react";

/**
 * When the workspace switches to the portrait arrangement.
 *
 * The desktop layout is a faithful copy of a 2105x1117 artboard: element sizes
 * come from the container's height while their positions are percentages of
 * its width, so the two only line up near the artwork's own shape. Below ~3:2
 * the composition tears — the card walks off the right edge — long before a
 * phone is reached, so the cut is made on aspect rather than device width.
 */
const QUERY = "(max-aspect-ratio: 3/2)";

const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/** True on portrait phones and any window too square for the artboard. */
export const useMobileLayout = () =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    // The server cannot know; desktop is the shape the page was designed at.
    () => false,
  );
