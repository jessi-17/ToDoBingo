"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import BingoCard from "./bingo-card";
import CircleItBack from "./circle-it-back";
import Confetti from "./confetti";
import Cross from "./cross";
import DoodleLayer, { type DoodleTool, type PenSettings } from "./doodle-layer";
import DoodlesPanel, { type PanelTool } from "./doodles-panel";
import {
  bodyFont,
  displayFont,
  FRAME_TOP,
  panelClass,
  panelStyle,
  s,
  scaleVars,
  SHEET_BOTTOM,
} from "./figma-scale";
import { completedLines, resolveCells, type Slot } from "./board";
import {
  ARCHIVE_LIMIT,
  docField,
  EMPTY_DOC,
  hasContent,
  update,
  useSaved,
} from "./board-store";
import { download, renderCard, renderThumb, toBlob } from "./card-export";
import ProfilePanel from "./profile-panel";
import QuotePanel from "./quote-panel";
import { QUOTES, shuffleFrom } from "./quotes";
import NameBeads from "./name-beads";
import NamePrompt from "./name-prompt";
import { storeName, useStoredName } from "./name-store";
import { type NoteFontId } from "./note-fonts";
import PlacedSticker, { DEFAULT_SIZE } from "./placed-sticker";
import SaveAs from "./save-as";
import Sidebar, { type ToolName } from "./sidebar";
import { sfx } from "./sounds";
import StickerDrawer from "./sticker-drawer";
import { type Sticker } from "./sticker-manifest";
import { importStickers } from "./sticker-upload";
import { type Task } from "./tasks";
import TextNote from "./text-note";
import TodoListPopup from "./todo-list-popup";
import { useMobileLayout } from "./use-mobile";
import Wordmark from "./wordmark";

/**
 * The largest number already used on a `prefix-N` key.
 *
 * Read off the items themselves rather than kept in a counter, because a
 * counter starts at zero again on every reload while the items it was numbering
 * came back from storage — the first note added after a refresh would be handed
 * `note-1` again and collide with one already on the page.
 */
const highest = (prefix: string, keys: string[]) =>
  keys.reduce((max, key) => {
    const n = Number(key.slice(prefix.length + 1));
    return key.startsWith(`${prefix}-`) && Number.isFinite(n) && n > max ? n : max;
  }, 0);

/**
 * Everything that sits on the notepad page. Lives inside the artwork's size
 * container, so its children inherit the artboard scale and the percentage
 * offsets below resolve against the page rather than the viewport.
 *
 * Offsets are taken from the Figma "To-do-List" frame (node 61:349), which is
 * 2105x1117.
 */
export default function Workspace() {
  /**
   * Portrait phones and squarish windows get a different arrangement of the
   * same pieces: the card up top at full width, the tool rail as a bottom
   * toolbar, and every panel as a bottom sheet between the two. The pieces
   * themselves are unchanged — each one takes its scale from one variable, so
   * the two layouts only differ in where things sit and what that variable is.
   */
  const mobile = useMobileLayout();
  // The to-do list is the default panel: it opens on arrival and toggles shut.
  const [openTool, setOpenTool] = useState<ToolName | null>("Todolist");
  /*
   * Everything below that outlives a reload comes from one saved document, not
   * from component state. The setters keep React's shape, so every child that
   * takes a `Dispatch<SetStateAction<T>>` is unchanged — the only difference is
   * that writing to one of them also schedules a save.
   */
  const saved = useSaved();
  const doc = saved.current;

  // Owned here so "Circle it back" can build its wheel from the same list.
  const tasks = doc.tasks;
  const setTasks = docField("tasks");
  // Chosen by the disc. Kept on the page rather than inside the disc panel, so
  // the priority is still there once the panel is closed.
  const [priority, setPriority] = useState<Task | null>(null);
  /**
   * Confetti. `n` is bumped on every win so the burst replays rather than
   * firing once, and `pieces` scales it to what was actually won — ticking one
   * task off is a handful, a bingo line is the whole page.
   */
  const [burst, setBurst] = useState({ n: 0, pieces: 0 });
  const celebrate = (pieces: number) => {
    // Small bursts stay visual-only: completing one task already has its
    // scribble, and a fanfare on top of it read as two competing sounds.
    if (pieces > 100) sfx.confetti(pieces);
    setBurst((current) => ({ n: current.n + 1, pieces }));
  };
  // The pop-out is the moment of the reveal; the text on the right is what
  // sticks around, so this clears itself rather than needing to be dismissed.
  const [reveal, setReveal] = useState<Task | null>(null);

  useEffect(() => {
    if (!reveal) return;
    const timer = setTimeout(() => setReveal(null), 4200);
    return () => clearTimeout(timer);
  }, [reveal, burst.n]);
  // undefined until storage has been read; null once we know it is unset.
  const name = useStoredName();

  const doodles = doc.doodles;
  const setDoodles = docField("doodles");
  const [drawTool, setDrawTool] = useState<PanelTool>("pencil");
  const [pen, setPen] = useState<PenSettings>({
    color: "#000000",
    opacity: 1,
    width: 6,
    brush: "heist",
    style: "solid",
    eraser: 26,
    font: "scribble",
    fontSize: 34,
  });
  /** Text boxes written onto the page with the text tool. */
  const notes = doc.notes;
  const setNotes = docField("notes");
  /** The note just placed, which takes the caret without being clicked. */
  const [freshNote, setFreshNote] = useState<string | null>(null);
  /**
   * The card's headings. Held here rather than in the card so they survive the
   * disc being swapped into the same slot and back.
   */
  const cardTitle = doc.title;
  const setCardTitle = docField("title");
  const cardFooter = doc.footer;
  const setCardFooter = docField("footer");
  /**
   * The right-hand slot holds one board at a time. "Circle it back" swaps the
   * disc in rather than opening a panel over it; picking the to-do list brings
   * the bingo card back.
   */
  const [board, setBoard] = useState<"bingo" | "disc">("bingo");
  /** What occupies each bingo square: a task from the list, or dropped text. */
  const squares = doc.squares;
  const setSquares = docField("squares");
  /**
   * Struck squares that are not backed by a task — dropped text and blank
   * free spaces. A task square takes its state from the task itself, which is
   * what keeps the card and the list in step; there is nowhere else for these
   * to live.
   */
  const freeMarks = useMemo(() => new Set(doc.freeMarks), [doc.freeMarks]);
  const setFreeMarks = (next: Set<number>) =>
    docField("freeMarks")([...next]);
  const placed = doc.stickers;
  const setPlaced = docField("stickers");
  const [selected, setSelected] = useState<string | null>(null);
  /**
   * The user's own sticker images. Held here rather than in the drawer so they
   * outlive it being closed — and so ids keep counting up across openings
   * instead of restarting and colliding with stickers already on the page.
   */
  const uploads = doc.uploads;
  const setUploads = docField("uploads");
  const surface = useRef<HTMLDivElement>(null);

  /** Newest first, so an upload lands in view without scrolling. */
  const addUploads = async (files: FileList) => {
    let n = highest("upload", uploads.map((sticker) => sticker.id));
    const { stickers, skipped } = await importStickers(
      files,
      () => `upload-${(n += 1)}`,
    );
    if (stickers.length) setUploads((current) => [...stickers, ...current]);
    return { added: stickers.length, skipped };
  };

  /**
   * Takes an upload off the shelf. Copies already dropped on the page keep
   * working — they carry the image data itself, not a reference to the shelf.
   */
  const removeUpload = (id: string) =>
    setUploads((current) => current.filter((sticker) => sticker.id !== id));

  /**
   * Puts the current card away and clears the desk for a new one.
   *
   * The picture is taken first and from the *live* page, because that is the
   * only moment the overlay artwork can be measured — once the board is reset
   * the doodles and stickers are gone, and a thumbnail rendered afterwards
   * would show a blank card.
   */
  const finishCard = async () => {
    sfx.shutter();
    sfx.sparkle(6);
    const thumb = await renderThumb(collectArt());
    const finished = doc;

    update((current) => ({
      ...current,
      current: {
        ...EMPTY_DOC,
        // The list itself carries over: the tasks are yours, not the card's.
        tasks: finished.tasks.map((task) => ({ ...task, done: false })),
        uploads: finished.uploads,
      },
      archive: [
        {
          id: `card-${Date.now()}`,
          title: finished.title,
          thumb,
          savedAt: Date.now(),
          doc: finished,
        },
        ...current.archive,
      ].slice(0, ARCHIVE_LIMIT),
      totals: {
        ...current.totals,
        cardsFinished: current.totals.cardsFinished + 1,
      },
    }));
    setPriority(null);
  };

  /**
   * Brings a card back to the desk. A swap rather than a load: whatever is on
   * the desk takes the archived card's place, so nothing is overwritten by
   * looking at something you made earlier.
   */
  const openCard = (id: string) => {
    update((current) => {
      const wanted = current.archive.find((card) => card.id === id);
      if (!wanted) return current;

      const others = current.archive.filter((card) => card.id !== id);
      return {
        ...current,
        current: wanted.doc,
        archive: hasContent(current.current)
          ? [
              {
                id: `card-${Date.now()}`,
                title: current.current.title,
                // Carries the old card's picture over; it is replaced next time
                // that card is put away properly.
                thumb: wanted.thumb,
                savedAt: Date.now(),
                doc: current.current,
              },
              ...others,
            ].slice(0, ARCHIVE_LIMIT)
          : others,
      };
    });
    setBoard("bingo");
    setPriority(null);
  };

  const deleteCard = (id: string) =>
    update((current) => ({
      ...current,
      archive: current.archive.filter((card) => card.id !== id),
    }));

  /** The board, resolved: every square with its label, state and colour. */
  const cells = resolveCells(squares, tasks, freeMarks);

  const doneFlags = cells.map((cell) => cell.done);
  const placedTaskIds = squares.flatMap((slot) =>
    slot?.kind === "task" ? [slot.id] : [],
  );

  /**
   * Celebrates a square being struck, sized to what it actually won.
   *
   * Called with the state the board is *about* to be in, because the confetti
   * has to know whether this particular strike closed a line, and that cannot
   * be read off the board until React has already re-rendered it.
   */
  const celebrateStrike = (index: number, struck: boolean, filled: boolean) => {
    if (!struck) return;
    const next = [...doneFlags];
    next[index] = true;

    if (completedLines(next) > completedLines(doneFlags)) {
      celebrate(160);
    } else if (filled) {
      celebrate(45);
    }
  };

  /**
   * The single place a task's done flag moves, whichever side asked.
   *
   * Both the checkbox in the list and the square on the card come through here,
   * so the two can never disagree and a line closed from either one celebrates
   * the same way.
   */
  const setTaskDone = (task: Task, done: boolean) => {
    if (done) sfx.scribble();
    else sfx.snip();
    const index = squares.findIndex(
      (slot) => slot?.kind === "task" && slot.id === task.id,
    );
    if (index !== -1) celebrateStrike(index, done, true);
    else if (done) celebrate(45);

    update((current) => ({
      ...current,
      current: {
        ...current.current,
        tasks: current.current.tasks.map((item) =>
          item.id === task.id ? { ...item, done } : item,
        ),
      },
      // A lifetime count, so finishing a card does not wipe the tally. Un-ticking
      // takes one back off rather than inflating it, and it cannot go negative
      // if a restored card arrives with tasks already crossed off.
      totals: {
        ...current.totals,
        tasksDone: Math.max(0, current.totals.tasksDone + (done ? 1 : -1)),
      },
    }));
  };

  /**
   * Removing a task removes it from the board with it. Leaving the square
   * pointing at a task that no longer exists would blank the square but still
   * count it as occupied, so the list would report more tasks on the board than
   * the board is showing.
   */
  const deleteTask = (task: Task) => {
    setTasks((current) => current.filter((item) => item.id !== task.id));
    setSquares((current) =>
      current.map((slot) =>
        slot?.kind === "task" && slot.id === task.id ? null : slot,
      ),
    );
  };

  /** Striking a square that holds no task: dropped text, or a free space. */
  const toggleFreeMark = (index: number) => {
    const struck = !freeMarks.has(index);
    if (struck) sfx.scribble();
    else sfx.snip();
    celebrateStrike(index, struck, squares[index] !== null);

    const next = new Set(freeMarks);
    if (struck) next.add(index);
    else next.delete(index);
    setFreeMarks(next);
  };

  const toggleCell = (index: number) => {
    const slot = squares[index];
    if (slot?.kind === "task") {
      const task = tasks.find((item) => item.id === slot.id);
      if (task) {
        setTaskDone(task, !task.done);
        return;
      }
    }
    toggleFreeMark(index);
  };

  /**
   * Gathers everything the export needs, at the moment the button is pressed.
   *
   * The two boxes are measured rather than derived. The card's size comes from
   * `--bu`, which comes from the container query, which comes from the window —
   * there is no number in this file that says how big the card currently is,
   * and guessing one would put every doodle and sticker in the wrong place.
   */
  const collectArt = () => {
    const card = surface.current
      ?.querySelector("[data-card]")
      ?.getBoundingClientRect();
    const page = surface.current?.getBoundingClientRect();

    return {
      cells,
      title: cardTitle,
      footer: cardFooter,
      overlay:
        card && page
          ? {
              // Relative to the page, since that is the space the artwork is
              // positioned in.
              card: {
                x: card.left - page.left,
                y: card.top - page.top,
                w: card.width,
                h: card.height,
              },
              page: { w: page.width, h: page.height },
              doodles,
              stickers: placed,
              notes,
            }
          : undefined,
    };
  };

  /** Puts something in a square, clearing whatever the square held before. */
  const fillSquare = (index: number, slot: Slot) => {
    setSquares((current) => {
      const next = [...current];
      // A task belongs to one square, so clear any earlier home first.
      if (slot.kind === "task") {
        const previous = next.findIndex(
          (item) => item?.kind === "task" && item.id === slot.id,
        );
        if (previous !== -1) next[previous] = null;
      }
      next[index] = slot;
      return next;
    });
    // The square's old occupant may have left a strike behind.
    if (freeMarks.has(index)) {
      const next = new Set(freeMarks);
      next.delete(index);
      setFreeMarks(next);
    }
  };

  /**
   * Lands a task on whichever bingo square it was released over.
   *
   * The square under the pointer is found by hit-testing the document rather
   * than by comparing rectangles: the card scales with the page and can be
   * swapped out entirely, so asking the browser what is actually under the
   * cursor stays correct without the two components sharing any geometry.
   */
  const assignToSquare = (task: Task, clientX: number, clientY: number) => {
    const hit = document
      .elementFromPoint(clientX, clientY)
      ?.closest("[data-cell]");
    if (!hit) return;

    const index = Number(hit.getAttribute("data-cell"));
    if (Number.isInteger(index)) {
      sfx.drop();
      fillSquare(index, { kind: "task", id: task.id });
    }
  };

  // --- quotes --------------------------------------------------------------
  const setQuote = (quote: string) =>
    update((current) => ({
      ...current,
      quotes: { ...current.quotes, current: quote },
    }));

  const setQuoteFont = (font: NoteFontId) =>
    update((current) => ({
      ...current,
      quotes: { ...current.quotes, font },
    }));

  const toggleFavourite = (quote: string) =>
    update((current) => ({
      ...current,
      quotes: {
        ...current.quotes,
        favourites: current.quotes.favourites.includes(quote)
          ? current.quotes.favourites.filter((item) => item !== quote)
          : [quote, ...current.quotes.favourites],
      },
    }));

  /**
   * Lays a quote on the paper as a text note, in whichever face the panel is
   * previewing and at a slight angle so it reads as written on rather than
   * typed in. Dropped clear of the panel that dropped it, and selected, so its
   * handles are already there to drag it onto the card or into a square.
   */
  const dropQuote = (quote: string) => {
    const key = `note-${highest("note", notes.map((item) => item.key)) + 1}`;
    setNotes((current) => [
      ...current,
      {
        key,
        text: quote,
        xPct: 0.5,
        yPct: 0.86,
        font: saved.quotes.font,
        size: 34,
        color: "#3d0e26",
        rotation: -2,
      },
    ]);
    setSelected(key);
  };

  /** Drops an empty text box where the text tool was clicked. */
  const placeNote = (xPct: number, yPct: number) => {
    sfx.pop(true);
    const key = `note-${highest("note", notes.map((item) => item.key)) + 1}`;

    setNotes((current) => [
      ...current,
      {
        key,
        text: "",
        xPct,
        yPct,
        font: pen.font,
        size: pen.fontSize,
        color: pen.color,
        rotation: 0,
      },
    ]);
    setSelected(key);
    setFreshNote(key);
  };

  /** Drops a sticker where it was released, clamped onto the page. */
  const dropSticker = (sticker: Sticker, clientX: number, clientY: number) => {
    const box = surface.current?.getBoundingClientRect();
    if (!box) return;
    sfx.drop();

    const xPct = Math.min(
      Math.max((clientX - box.left) / box.width, 0.02),
      0.98,
    );
    const yPct = Math.min(Math.max((clientY - box.top) / box.height, 0.02), 0.98);
    const key = `placed-${highest("placed", placed.map((item) => item.key)) + 1}`;
    setPlaced((current) => [
      ...current,
      {
        key,
        src: sticker.src,
        xPct,
        yPct,
        size: DEFAULT_SIZE,
        rotation: 0,
        aspect: sticker.w / sticker.h || 1,
      },
    ]);
    setSelected(key);
  };

  return (
    <div
      ref={surface}
      onPointerDown={(event) => {
        setSelected(null);
        // One delegated tick under every button on the page, so each control
        // answers the finger without every component carrying its own wiring.
        // Card squares and done-checkboxes are exempt: their press already
        // speaks as the scribble, and a click underneath it doubled the sound.
        const pressed = (event.target as HTMLElement).closest("button");
        if (pressed && !pressed.closest("[data-cell]") && !pressed.hasAttribute("aria-pressed")) {
          sfx.tick();
        }
      }}
      onKeyDown={(event) => {
        // Typewriter taps for typing, wherever the caret is — inputs and the
        // text notes alike. Held-key repeats stay silent; thirty taps a
        // second reads as a fault, not typing.
        if (event.repeat) return;
        const el = event.target as HTMLElement;
        if (!(el instanceof HTMLInputElement) && !el.isContentEditable) return;
        if (event.key === "Backspace") sfx.key(true);
        else if (event.key.length === 1) sfx.key();
      }}
      className="absolute inset-0"
    >
      {/* Keys are prefixed because the reveal below is keyed off the same
          counter, and two siblings sharing a key is undefined behaviour. */}
      {burst.n > 0 ? (
        <Confetti
          key={`confetti-${burst.n}`}
          pieces={burst.pieces}
          salt={burst.n}
        />
      ) : null}

      {/* The chosen task, bursting out of the middle of the page. */}
      {reveal ? (
        <button
          key={`reveal-${burst.n}`}
          type="button"
          onClick={() => setReveal(null)}
          aria-label={`Priority: ${reveal.label}. Dismiss`}
          style={{
            ...scaleVars,
            ...panelStyle,
            borderRadius: s(28),
            paddingBlock: s(30),
            paddingInline: s(56),
            // A long task on a narrow screen has nowhere else to go.
            maxWidth: "92cqw",
            fontFamily: bodyFont,
          }}
          className={`task-pop absolute left-1/2 top-1/2 z-[60] -translate-x-1/2 -translate-y-1/2 cursor-pointer text-center ${panelClass}`}
        >
          <span
            style={{ fontSize: s(14), lineHeight: s(18) }}
            className="block uppercase tracking-[0.28em] text-black/50"
          >
            your priority
          </span>
          <span
            style={{
              fontFamily: displayFont,
              fontSize: s(46),
              lineHeight: s(56),
              marginTop: s(6),
            }}
            className="block text-[#1e1e1e]"
          >
            {reveal.label}
          </span>
        </button>
      ) : null}

      {priority ? (
        // Plain text on the paper — no panel. Sits just under the binding and
        // above the bingo card, which now starts at 18%.
        <div
          style={{
            ...scaleVars,
            fontFamily: bodyFont,
            columnGap: s(10),
            maxWidth: mobile ? "58cqw" : "94cqw",
            bottom: mobile ? SHEET_BOTTOM : undefined,
          }}
          className={`absolute z-40 flex items-baseline ${
            mobile ? "left-[5%]" : "right-[6%] top-[12.5%]"
          }`}
        >
          <span
            style={{ fontSize: s(12), lineHeight: s(16) }}
            className="uppercase tracking-[0.18em] text-black/45"
          >
            priority
          </span>
          <span
            style={{ fontSize: s(26), lineHeight: s(32) }}
            className="min-w-0 truncate text-black"
          >
            {priority.label}
          </span>
          <button
            type="button"
            onClick={() => setPriority(null)}
            aria-label="Clear priority"
            style={{ width: s(20), height: s(20) }}
            className="flex cursor-pointer items-center justify-center opacity-45 transition hover:opacity-100"
          >
            <Cross size={13} />
          </button>
        </div>
      ) : null}

      {name ? (
        // On portrait the beads hang on the binding itself, so they are
        // anchored to the band's rendered height — a page percentage lands
        // above or below the rings as the window changes shape.
        <div
          style={mobile ? { top: `calc(${FRAME_TOP} * 0.35)` } : undefined}
          className={`absolute z-10 ${
            mobile ? "left-1/2 -translate-x-1/2" : "left-[15%] top-[17%]"
          }`}
        >
          <NameBeads
            name={name}
            size={mobile ? 36 : 54}
            gap={mobile ? 4 : 6}
          />
        </div>
      ) : null}

      <DoodleLayer
        tool={
          (openTool === "Pencil"
            ? drawTool
            : openTool === "Eraser"
              ? "eraser"
              : null) as DoodleTool
        }
        pen={pen}
        setPen={setPen}
        doodles={doodles}
        setDoodles={setDoodles}
        onPlaceText={placeNote}
      />

      {/* Told once the eraser is in hand, since nothing else advertises it. */}
      {openTool === "Eraser" ? (
        <div
          style={{
            ...scaleVars,
            ...panelStyle,
            borderRadius: s(16),
            paddingBlock: s(10),
            paddingInline: s(20),
            columnGap: s(14),
            fontFamily: bodyFont,
            // Where a sheet would rest — the eraser has no sheet of its own.
            bottom: mobile ? SHEET_BOTTOM : undefined,
          }}
          className={`absolute left-1/2 z-45 flex -translate-x-1/2 items-center ${
            mobile ? "" : "top-[17%]"
          } ${panelClass}`}
        >
          <span style={{ fontSize: s(15) }} className="text-[#3d0e26]">
            Rub over a drawing to erase part of it
          </span>
          {/* The resize shortcut is keyboard-only, so on a phone it is noise. */}
          {!mobile ? (
            <>
              <span
                style={{ fontSize: s(13), columnGap: s(5) }}
                className="flex items-center text-black/55"
              >
                <kbd
                  style={{
                    paddingInline: s(7),
                    paddingBlock: s(2),
                    borderRadius: s(5),
                    borderWidth: s(1),
                  }}
                  className="border-black/25 bg-white/70"
                >
                  Ctrl
                </kbd>
                +
                <kbd
                  style={{
                    paddingInline: s(7),
                    paddingBlock: s(2),
                    borderRadius: s(5),
                    borderWidth: s(1),
                  }}
                  className="border-black/25 bg-white/70"
                >
                  + / −
                </kbd>
                to resize
              </span>
              <span
                style={{ fontSize: s(13) }}
                className="tabular-nums text-black/45"
              >
                {Math.round(pen.eraser)}
              </span>
            </>
          ) : null}
        </div>
      ) : null}

      {/*
        The card sits on the page itself, not in a panel. `--bu` is one of its
        design pixels expressed in artboard units, so it scales with everything
        else — 0.88 puts its 803pt height at 63% of the page, clearing the
        priority line above it and the notepad frame below.
      */}
      {board === "bingo" ? (
        <BingoCard
          cells={cells}
          title={cardTitle}
          footer={cardFooter}
          onTitleChange={setCardTitle}
          onFooterChange={setCardFooter}
          onToggleCell={toggleCell}
          style={
            mobile
              ? // Sized from the width so the card leads the page, leaving the
                // lower half for the toolbar and whichever sheet is open. Its
                // top hangs off the binding band, which is not a fixed height.
                {
                  ["--bu" as string]: "min(88cqw / 645, 56cqh / 803)",
                  top: `calc(${FRAME_TOP} + 10px)`,
                }
              : {
                  ...scaleVars,
                  ["--bu" as string]: "calc(var(--s) * 1.05)",
                }
          }
          className={`absolute z-10 ${
            mobile
              ? "left-1/2 -translate-x-1/2"
              : "left-[62%] top-1/2 -translate-y-1/2"
          }`}
        />
      ) : (
        <CircleItBack
          tasks={tasks}
          mobile={mobile}
          onClose={() => {
            sfx.cdTray();
            setBoard("bingo");
          }}
          onPriority={(task) => {
            setPriority(task);
            setReveal(task);
            celebrate(120);
          }}
        />
      )}

      {/*
        Only offered while the card is the thing on screen — there is nothing to
        export from the disc. Sits under the card in the right-hand slot.
      */}
      {board === "bingo" ? (
        <SaveAs
          art={collectArt}
          name={name}
          style={mobile ? { bottom: SHEET_BOTTOM } : undefined}
          className={
            mobile ? "right-[5%] z-40" : "right-[3.7%] top-[88.6%] z-40"
          }
        />
      ) : null}

      {/* 168/2105, 228/1117 */}
      <Sidebar
        horizontal={mobile}
        className={`absolute z-40 ${
          mobile
            ? "bottom-[1.2%] left-1/2 -translate-x-1/2"
            : "left-[7.98%] top-[20.41%]"
        }`}
        onToolClick={(tool) => {
          // The two boards are exclusive and share the right-hand slot: the
          // disc replaces the card in place rather than opening over it, and
          // picking the to-do list brings the card back.
          if (tool === "Circle it back") {
            sfx.cdTray();
            setBoard("disc");
            setOpenTool(null);
            return;
          }
          if (tool === "Todolist") setBoard("bingo");
          sfx.pop(openTool !== tool);
          setOpenTool((current) => (current === tool ? null : tool));
        }}
      />

      {/*
        Positioned by eye rather than from Figma. The artboard is 1.885:1 while
        the notepad artwork is 2:1, so offsets taken from the artboard drift —
        vertical ones increasingly so the further down the page they sit.
        Portrait centres it in the paper left bare under the card.
      */}
      <Wordmark
        mobile={mobile}
        className={
          mobile
            ? "bottom-[18%] left-1/2 -translate-x-1/2"
            : "left-[16.57%] top-[65.5%]"
        }
      />

      {placed.map((sticker) => (
        <PlacedSticker
          key={sticker.key}
          sticker={sticker}
          selected={selected === sticker.key}
          onSelect={() => setSelected(sticker.key)}
          onChange={(next) =>
            setPlaced((current) =>
              current.map((item) => (item.key === next.key ? next : item)),
            )
          }
          onRemove={() =>
            setPlaced((current) =>
              current.filter((item) => item.key !== sticker.key),
            )
          }
        />
      ))}

      {notes.map((note) => (
        <TextNote
          key={note.key}
          note={note}
          selected={selected === note.key}
          fresh={freshNote === note.key}
          onSelect={() => setSelected(note.key)}
          onChange={(next) => {
            // Any interaction settles the note, so the caret is not snatched
            // back to it once the user has moved on to something else.
            setFreshNote((current) => (current === next.key ? null : current));
            setNotes((current) =>
              current.map((item) => (item.key === next.key ? next : item)),
            );
          }}
          onCommit={(text) => {
            setFreshNote((current) => (current === note.key ? null : current));
            // A note left blank was a stray click; sweep it up rather than
            // leaving an invisible box on the page to be hunted down.
            if (!text.trim()) {
              setNotes((current) =>
                current.filter((item) => item.key !== note.key),
              );
              return;
            }
            setNotes((current) =>
              current.map((item) =>
                item.key === note.key ? { ...item, text } : item,
              ),
            );
          }}
          onLand={(index) => {
            // Nothing useful to put in a square, so leave it on the page.
            if (!note.text.trim()) return;
            fillSquare(index, {
              kind: "note",
              text: note.text,
              font: note.font,
              color: note.color,
            });
            // It belongs to the card now, so it stops being page furniture.
            setNotes((current) =>
              current.filter((item) => item.key !== note.key),
            );
            setSelected(null);
          }}
          onRemove={() =>
            setNotes((current) =>
              current.filter((item) => item.key !== note.key),
            )
          }
        />
      ))}

      {openTool === "Pencil" ? (
        <DoodlesPanel
          pen={pen}
          setPen={setPen}
          tool={drawTool}
          setTool={setDrawTool}
          mobile={mobile}
          onClose={() => setOpenTool(null)}
        />
      ) : null}

      {openTool === "Todolist" ? (
        <TodoListPopup
          tasks={tasks}
          setTasks={setTasks}
          mobile={mobile}
          onClose={() => setOpenTool(null)}
          onDropTask={assignToSquare}
          onToggleDone={setTaskDone}
          onDelete={deleteTask}
          placedIds={placedTaskIds}
        />
      ) : null}

      {openTool === "Stickers" ? (
        <StickerDrawer
          mobile={mobile}
          onClose={() => setOpenTool(null)}
          onDrop={dropSticker}
          uploads={uploads}
          onUpload={addUploads}
          onRemoveUpload={removeUpload}
        />
      ) : null}
      {openTool === "Quote" ? (
        <QuotePanel
          quote={saved.quotes.current}
          favourites={saved.quotes.favourites}
          font={saved.quotes.font}
          onFont={setQuoteFont}
          onShuffle={() =>
            setQuote(
              shuffleFrom(
                // Your own lines join the pool, so shuffling keeps offering
                // them back rather than only ever cycling the built-in set.
                [...QUOTES, ...saved.quotes.favourites],
                saved.quotes.current,
              ),
            )
          }
          onPick={setQuote}
          onToggleFavourite={toggleFavourite}
          onUseAsTitle={setCardTitle}
          onUseAsFooter={setCardFooter}
          onDropOnPage={dropQuote}
          onClose={() => setOpenTool(null)}
          className="left-[29%] top-1/2 -translate-y-1/2"
        />
      ) : null}

      {openTool === "Profile" ? (
        <ProfilePanel
          name={name}
          onRename={storeName}
          stats={{
            // Two of these are about this card, two are about you: how much of
            // the board is filled and how many lines it has are properties of
            // the card in front of you, while tasks crossed off and cards
            // finished carry across every card you have ever made.
            tasksDone: saved.totals.tasksDone,
            lines: completedLines(doneFlags),
            filled: squares.filter(Boolean).length,
            finished: saved.totals.cardsFinished,
          }}
          archive={saved.archive}
          canFinish={hasContent(doc)}
          onFinish={finishCard}
          onOpen={(id) => {
            openCard(id);
            setOpenTool(null);
          }}
          onDownload={async (id) => {
            const card = saved.archive.find((item) => item.id === id);
            if (!card) return;
            /*
             * Rendered from the stored document with no overlay: the doodles
             * and stickers on an archived card were positioned against a page
             * that is not on screen any more, so there is nothing to measure
             * them against. The thumbnail keeps the likeness; this keeps the
             * board itself at full size.
             */
            const canvas = await renderCard({
              cells: resolveCells(card.doc.squares, card.doc.tasks, card.doc.freeMarks),
              title: card.doc.title,
              footer: card.doc.footer,
            });
            download(
              await toBlob(canvas),
              `todobingo-${new Date(card.savedAt).toISOString().slice(0, 10)}.png`,
            );
          }}
          onDelete={deleteCard}
          onClose={() => setOpenTool(null)}
          mobile={mobile}
          className={
            mobile
              ? "left-1/2 -translate-x-1/2"
              : "left-[29%] top-1/2 -translate-y-1/2"
          }
        />
      ) : null}

      {name === null ? (
        <NamePrompt
          onConfirm={storeName}
        />
      ) : null}
    </div>
  );
}
