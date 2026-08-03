"use client";

import { useSyncExternalStore } from "react";

import { type Slot } from "./board";
import { type Doodle } from "./doodle-brushes";
import { type Note, type NoteFontId } from "./note-fonts";
import { type Placed } from "./placed-sticker";
import { QUOTES } from "./quotes";
import { type Sticker } from "./sticker-manifest";
import { INITIAL_TASKS, type Task } from "./tasks";

/**
 * Everything the page is worth keeping, in one document, in localStorage.
 *
 * Read through `useSyncExternalStore` for the same reason the name is: it is
 * the API built for reading browser state during render without upsetting
 * hydration. The server has no storage, so it is served `EMPTY` and React swaps
 * in what was saved once the page is live — no effect, no setState-in-effect,
 * and no flash of an empty board at a returning visitor.
 *
 * One document rather than a key per field. The board only makes sense whole: a
 * square points at a task by id, and a half-written save where the squares
 * landed but the tasks did not would leave the card referring to tasks that no
 * longer exist. A single `setItem` is the only way to make that atomic.
 */
const KEY = "todobingo:board";

/**
 * Bumped when the shape changes in a way old data cannot satisfy. There is no
 * migration path yet, so a mismatch is discarded rather than half-read — silent
 * corruption is worse than a fresh board.
 */
const VERSION = 1;

export type BoardDoc = {
  tasks: Task[];
  /** What occupies each of the 25 squares. */
  squares: (Slot | null)[];
  /** Struck squares not backed by a task. An array because a Set is not JSON. */
  freeMarks: number[];
  title: string;
  footer: string;
  doodles: Doodle[];
  stickers: Placed[];
  notes: Note[];
  /** The user's own sticker images, as data URLs. */
  uploads: Sticker[];
};

/** A card put away, with a picture of it so the list is worth looking at. */
export type ArchivedCard = {
  id: string;
  title: string;
  /** Small WebP data URL. */
  thumb: string;
  savedAt: number;
  doc: BoardDoc;
};

/**
 * Kept beside the card rather than inside it: a line you liked is yours, not
 * that card's, and it should still be there on the next one.
 */
export type QuoteState = {
  current: string;
  favourites: string[];
  /** The face a quote is previewed in and dropped in. */
  font: NoteFontId;
};

export type Saved = {
  version: number;
  current: BoardDoc;
  archive: ArchivedCard[];
  /** Lifetime totals, which survive a card being put away. */
  totals: { tasksDone: number; cardsFinished: number };
  quotes: QuoteState;
};

export const EMPTY_DOC: BoardDoc = {
  tasks: INITIAL_TASKS,
  squares: Array(25).fill(null),
  freeMarks: [],
  title: "you are a work in progress",
  footer: "Act like the Girl you want to be !",
  doodles: [],
  stickers: [],
  notes: [],
  uploads: [],
};

const EMPTY: Saved = {
  version: VERSION,
  current: EMPTY_DOC,
  archive: [],
  totals: { tasksDone: 0, cardsFinished: 0 },
  // Fixed rather than random, so the server and the browser agree on what the
  // panel says before anyone has pressed shuffle.
  quotes: { current: QUOTES[0], favourites: [], font: "script" },
};

/** Past this many, the oldest is dropped — see `persist` for why. */
export const ARCHIVE_LIMIT = 12;

// --- the store ------------------------------------------------------------
let snapshot: Saved = EMPTY;
let loaded = false;
let listeners: (() => void)[] = [];

const notify = () => listeners.forEach((listener) => listener());

const read = (): Saved => {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Saved;
    if (parsed?.version !== VERSION) return EMPTY;
    // Spread over the defaults so a document written by an older build that
    // simply lacked a field still opens.
    return {
      ...EMPTY,
      ...parsed,
      current: { ...EMPTY_DOC, ...parsed.current },
      totals: { ...EMPTY.totals, ...parsed.totals },
      quotes: { ...EMPTY.quotes, ...parsed.quotes },
    };
  } catch {
    return EMPTY;
  }
};

// --- saving ---------------------------------------------------------------
export type SaveState = { at: number | null; error: string | null };

let saveState: SaveState = { at: null, error: null };
let saveListeners: (() => void)[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

const setSaveState = (next: SaveState) => {
  saveState = next;
  saveListeners.forEach((listener) => listener());
};

const write = () => {
  timer = null;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(snapshot));
    setSaveState({ at: Date.now(), error: null });
  } catch {
    /*
     * Almost always the ~5MB quota, reached by archived cards carrying their
     * own uploads and doodles. Dropping the oldest card is the one thing that
     * reliably frees a large block, and it is better than silently losing the
     * board the user is working on right now.
     */
    if (snapshot.archive.length > 1) {
      snapshot = { ...snapshot, archive: snapshot.archive.slice(0, -1) };
      notify();
      write();
      return;
    }
    setSaveState({
      at: saveState.at,
      error: "Out of browser storage — older cards were dropped.",
    });
  }
};

/**
 * Writes are debounced: a single pencil stroke produces a state change per
 * pointer move, and serialising the whole document on each one would stutter
 * the drawing. Flushed on the way out so nothing is lost by closing the tab
 * mid-gesture.
 */
const schedule = () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(write, 400);
};

export const flush = () => {
  if (timer) {
    clearTimeout(timer);
    write();
  }
};

if (typeof window !== "undefined") {
  // `pagehide` rather than `beforeunload`: it is the one that fires on mobile
  // when the tab is backgrounded, which is how phones usually end a session.
  window.addEventListener("pagehide", flush);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

const subscribe = (onChange: () => void) => {
  listeners = [...listeners, onChange];
  return () => {
    listeners = listeners.filter((listener) => listener !== onChange);
  };
};

const getSnapshot = (): Saved => {
  if (!loaded) {
    loaded = true;
    snapshot = read();
  }
  return snapshot;
};

const getServerSnapshot = (): Saved => EMPTY;

export const useSaved = () =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

export const useSaveState = () =>
  useSyncExternalStore(
    (onChange: () => void) => {
      saveListeners = [...saveListeners, onChange];
      return () => {
        saveListeners = saveListeners.filter((l) => l !== onChange);
      };
    },
    () => saveState,
    () => ({ at: null, error: null }) as SaveState,
  );

export const update = (change: (current: Saved) => Saved) => {
  snapshot = change(getSnapshot());
  notify();
  schedule();
};

/** Narrows an update to the card being worked on now. */
export const updateDoc = (change: (doc: BoardDoc) => BoardDoc) =>
  update((saved) => ({ ...saved, current: change(saved.current) }));

/**
 * A React-shaped setter for one field of the current card, so the components
 * that already take a `Dispatch<SetStateAction<T>>` keep working unchanged.
 */
export const docField =
  <K extends keyof BoardDoc>(key: K) =>
  (value: React.SetStateAction<BoardDoc[K]>) =>
    updateDoc((doc) => ({
      ...doc,
      [key]:
        typeof value === "function"
          ? (value as (previous: BoardDoc[K]) => BoardDoc[K])(doc[key])
          : value,
    }));

/** True when the card has anything on it worth keeping. */
export const hasContent = (doc: BoardDoc) =>
  doc.squares.some(Boolean) ||
  doc.doodles.length > 0 ||
  doc.stickers.length > 0 ||
  doc.notes.length > 0;
