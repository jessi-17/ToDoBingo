"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import search from "../../public/icons/SEARCH.png";
import flower from "../../public/icons/todo/flower.png";
import pencil from "../../public/icons/todo/pencil.png";
import Cross, { INK } from "./cross";
import {
  bodyFont,
  displayFont,
  panelClass,
  panelStyle,
  s,
  panelScaleVars,
  scaleVars,
  SHEET_BOTTOM,
  sheetScaleVars,
} from "./figma-scale";
import { sfx } from "./sounds";
import { ROW_COLORS, type Task } from "./tasks";

/**
 * The "To-do list" popup from Figma node 61:364.
 *
 * Two independent drags live in here and must not fight each other:
 *  - the card itself moves around the notepad,
 *  - a task row reorders within the list.
 * Rows always stop propagation, so grabbing a row reorders instead of sliding
 * the card. The card is dragged by its background, title, or padding.
 */

/** Nudged up slightly from the raw Figma values, at the artwork's own aspect. */
const ICON = {
  search: 39,
  pencil: { w: 18, h: 24 },
  check: { w: 14, h: 13 },
  cross: 16,
};


export default function TodoListPopup({
  tasks,
  setTasks,
  onClose,
  onDropTask,
  onToggleDone,
  onDelete,
  placedIds = [],
  mobile = false,
}: {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  onClose: () => void;
  /** A task dragged clear of the list and released elsewhere on the page. */
  onDropTask?: (task: Task, clientX: number, clientY: number) => void;
  /**
   * Bottom sheet on the portrait layout. The panel stops being draggable —
   * a sheet has one place to be — and, while a task is being carried out of
   * it, slides itself off the page so the whole card is reachable underneath.
   */
  mobile?: boolean;
  /**
   * Ticking a task off is owned by the page, not by this list: the same flag
   * strikes the square the task sits on, and completing a line from here has to
   * celebrate exactly as it would from the card.
   */
  onToggleDone?: (task: Task, done: boolean) => void;
  /** Deleting a task has to take it off the board too. */
  onDelete?: (task: Task) => void;
  /** Ids of tasks that have been dragged onto the board. */
  placedIds?: number[];
}) {
  const onBoard = new Set(placedIds);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");

  // --- card drag -----------------------------------------------------------
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const origin = useRef({ px: 0, py: 0, ox: 0, oy: 0 });
  const card = useRef<HTMLElement>(null);
  /**
   * Drag limits, measured once when the drag starts. Deriving them per-move
   * from `offset` races the DOM: React's state lags the applied transform
   * during fast pointer streams, so the untranslated origin comes out wrong.
   */
  const limits = useRef({ minX: 0, maxX: 0, minY: 0, maxY: 0 });

  const measureLimits = () => {
    const el = card.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;

    const rect = el.getBoundingClientRect();
    const bounds = parent.getBoundingClientRect();
    const baseLeft = rect.left - offset.x;
    const baseTop = rect.top - offset.y;
    // Leave a grabbable sliver rather than pinning it fully inside.
    const keep = Math.min(64, rect.width / 2);

    limits.current = {
      minX: bounds.left - baseLeft - rect.width + keep,
      maxX: bounds.right - baseLeft - keep,
      minY: bounds.top - baseTop,
      maxY: bounds.bottom - baseTop - rect.height,
    };
  };

  const startDrag = (event: React.PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("input, button, li")) return;
    origin.current = {
      px: event.clientX,
      py: event.clientY,
      ox: offset.x,
      oy: offset.y,
    };
    measureLimits();
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onDrag = (event: React.PointerEvent) => {
    if (!dragging) return;
    const { px, py, ox, oy } = origin.current;
    const { minX, maxX, minY, maxY } = limits.current;
    setOffset({
      x: Math.min(Math.max(ox + (event.clientX - px), minX), maxX),
      y: Math.min(Math.max(oy + (event.clientY - py), minY), maxY),
    });
  };

  const endDrag = (event: React.PointerEvent<HTMLElement>) => {
    setDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  // --- row reorder ---------------------------------------------------------
  /**
   * The list is NOT reordered while dragging. The lifted row tracks the
   * pointer, and the rows it has passed slide one slot out of its way. Only on
   * release is the array spliced. Mutating the array mid-drag would reorder the
   * DOM, which CSS transitions cannot animate — nothing would appear to move.
   */
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [dragRow, setDragRow] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [liftY, setLiftY] = useState(0);
  const rowStart = useRef({ py: 0, index: 0 });
  // Read during render for the row transforms, so it must be state: reading a
  // ref while rendering is not safe under concurrent rendering.
  const [pitch, setPitch] = useState(0);
  const slots = useRef<number[]>([]);
  /**
   * Where the pointer is once it leaves the panel. A row drag means "reorder"
   * while it stays inside and "carry this task somewhere" once it does not, so
   * one gesture covers both without a separate handle.
   */
  const [carry, setCarry] = useState<{ x: number; y: number } | null>(null);

  const startRowDrag = (
    event: React.PointerEvent<HTMLLIElement>,
    index: number,
  ) => {
    // A row never drags the card, whatever else happens next.
    event.stopPropagation();
    if ((event.target as HTMLElement).closest("input, button")) return;

    slots.current = rowRefs.current.flatMap((el) => {
      if (!el) return [];
      const rect = el.getBoundingClientRect();
      return [rect.top + rect.height / 2];
    });
    if (slots.current.length < 2) return;

    setPitch(slots.current[1] - slots.current[0]);
    rowStart.current = { py: event.clientY, index };
    sfx.pickup();
    setDragRow(index);
    setDropIndex(index);
    setLiftY(0);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onRowDrag = (event: React.PointerEvent<HTMLLIElement>) => {
    if (dragRow === null || !pitch) return;
    event.stopPropagation();

    const panel = card.current?.getBoundingClientRect();
    const outside =
      panel &&
      (event.clientX < panel.left ||
        event.clientX > panel.right ||
        event.clientY < panel.top ||
        event.clientY > panel.bottom);

    if (outside) {
      setCarry({ x: event.clientX, y: event.clientY });
      return;
    }
    setCarry(null);

    const travel = event.clientY - rowStart.current.py;
    // The nearest slot centre to where the row's own centre now is. Measured
    // against the real centres rather than a uniform pitch, because a row
    // that wrapped to two lines makes the pitch a lie.
    const want = slots.current[rowStart.current.index] + travel;
    let target = 0;
    let nearest = Infinity;
    slots.current.forEach((centre, i) => {
      const gap = Math.abs(centre - want);
      if (gap < nearest) {
        nearest = gap;
        target = i;
      }
    });

    setLiftY(travel);
    setDropIndex(target);
  };

  const endRowDrag = (event: React.PointerEvent<HTMLLIElement>) => {
    if (dragRow === null) return;
    event.stopPropagation();
    event.currentTarget.releasePointerCapture(event.pointerId);

    if (carry) {
      onDropTask?.(tasks[dragRow], carry.x, carry.y);
    } else if (dropIndex !== null && dropIndex !== dragRow) {
      // Landing a reorder; a carry landing on the card sounds from the page.
      sfx.drop();
      setTasks((current) => {
        const next = [...current];
        const [moved] = next.splice(dragRow, 1);
        next.splice(dropIndex, 0, moved);
        return next;
      });
    }
    setDragRow(null);
    setDropIndex(null);
    setLiftY(0);
    setCarry(null);
  };

  /** Where a row sits while a drag is in flight. */
  const rowShift = (index: number) => {
    if (dragRow === null || dropIndex === null) return 0;
    if (index === dragRow) return liftY;
    // Rows between the grab point and the drop point step aside by one slot.
    if (dragRow < dropIndex && index > dragRow && index <= dropIndex) {
      return -pitch;
    }
    if (dragRow > dropIndex && index < dragRow && index >= dropIndex) {
      return pitch;
    }
    return 0;
  };

  // --- task actions --------------------------------------------------------
  const addTask = () => {
    const label = draft.trim();
    if (!label) return;
    sfx.pop(true);
    setTasks((current) => {
      // Continue the cycle from the row above, so a new task never lands on
      // the same colour as its neighbour after reordering or deletions.
      const previous = current.at(-1);
      const next = previous ? ROW_COLORS.indexOf(previous.color) + 1 : 0;

      return [
        ...current,
        {
          id: Date.now(),
          label,
          done: false,
          color: ROW_COLORS[next % ROW_COLORS.length],
        },
      ];
    });
    setDraft("");
  };

  const commitEdit = () => {
    const label = editDraft.trim();
    if (label) {
      setTasks((current) =>
        current.map((task) =>
          task.id === editingId ? { ...task, label } : task,
        ),
      );
    }
    setEditingId(null);
  };

  return (
    <>
      {/*
        Follows the pointer once a task is carried clear of the list. Drawn at
        the page's full scale rather than the panel's, and deliberately larger
        than the row it came from: it has to stay legible over the whole notepad
        and read as something held in the hand, not as a row that fell out.
      */}
      {carry && dragRow !== null ? (
        <div
          style={{
            ...scaleVars,
            left: carry.x,
            top: carry.y,
            borderRadius: s(18),
            paddingBlock: s(16),
            paddingInline: s(26),
            columnGap: s(14),
            fontSize: s(24),
            lineHeight: s(28),
            fontFamily: bodyFont,
            backgroundColor: tasks[dragRow]?.color,
            borderWidth: s(1),
            boxShadow: `0 ${s(18)} ${s(34)} rgba(61,14,38,0.34), inset 0 ${s(2)} ${s(4)} rgba(211,162,102,0.5)`,
          }}
          className="pointer-events-none fixed z-[70] flex -translate-x-1/2 -translate-y-1/2 rotate-3 items-center border-black/15 whitespace-nowrap text-black"
        >
          {/* The row's own bullet, so the thing in hand is recognisably it. */}
          <span
            style={{ width: s(21), height: s(20), borderWidth: s(1.5) }}
            className="shrink-0 rounded-full border-[#3d0e26] bg-[#fffdf7]"
          />
          {tasks[dragRow]?.label}
        </div>
      ) : null}

    <section
      ref={card}
      aria-label="To-do list"
      onPointerDown={mobile ? undefined : startDrag}
      onPointerMove={mobile ? undefined : onDrag}
      onPointerUp={mobile ? undefined : endDrag}
      onPointerCancel={mobile ? undefined : endDrag}
      style={{
        ...(mobile ? sheetScaleVars(389) : panelScaleVars),
        ...panelStyle,
        width: s(389),
        padding: s(32),
        rowGap: s(24),
        fontFamily: bodyFont,
        maxHeight: mobile ? "58cqh" : undefined,
        bottom: mobile ? SHEET_BOTTOM : undefined,
        // Carrying a task out sends the sheet home, so the finger is not
        // dropping onto a card that is half hidden behind the list.
        transform: mobile
          ? carry
            ? "translateY(150%)"
            : undefined
          : `translate(${offset.x}px, ${offset.y}px)`,
        transition: mobile
          ? "transform 240ms cubic-bezier(0.22, 0.9, 0.3, 1)"
          : undefined,
        touchAction: mobile ? undefined : "none",
      }}
      className={`absolute z-45 flex flex-col ${panelClass} ${
        mobile
          ? "left-1/2 -translate-x-1/2"
          : `left-[29%] top-1/2 -translate-y-1/2 ${
              dragging ? "cursor-grabbing select-none" : "cursor-grab"
            }`
      }`}
    >
      {/* Title, with the flower sticker overlapping the top edge as in Figma. */}
      <header className="relative flex items-center">
        <div className="flex flex-col">
          <h2
            style={{
              fontFamily: displayFont,
              fontSize: s(32),
              lineHeight: s(37),
              fontWeight: 500,
            }}
            className="text-[#1e1e1e]"
          >
            To-do list
          </h2>
          {/*
            How much of the list has made it onto the card. Without this the
            only way to know what is still waiting to be placed is to read the
            board and the list side by side and diff them by eye.
          */}
          <span
            style={{ fontSize: s(12), lineHeight: s(16) }}
            className="text-black/45"
          >
            {onBoard.size > 0
              ? `${onBoard.size} of ${tasks.length} on the board`
              : "drag a task onto the card"}
          </span>
        </div>

        <Image
          src={flower}
          alt=""
          style={{ width: s(41), height: s(41), left: s(114), top: s(-2) }}
          className="pointer-events-none absolute max-w-none"
        />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close to-do list"
          style={{ width: s(45), height: s(43) }}
          className="ml-auto flex cursor-pointer items-center justify-center transition-transform hover:scale-105 active:scale-95"
        >
          <Cross size={22} color={INK} />
        </button>
      </header>

      {/* New task row */}
      <div style={{ columnGap: s(16) }} className="flex items-center">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && addTask()}
          placeholder="write your tasks ...."
          style={{
            width: s(270),
            height: s(40),
            borderRadius: s(12),
            paddingInline: s(14),
            fontSize: s(16),
            boxShadow: `0 ${s(1)} ${s(2.3)} rgba(0,0,0,0.25)`,
          }}
          className="border border-black/10 bg-white text-left text-black placeholder:text-black/70 focus:outline-none"
        />

        <button
          type="button"
          onClick={addTask}
          aria-label="Add task"
          style={{ width: s(ICON.search), height: s(ICON.search) }}
          className="flex cursor-pointer items-center justify-center transition-transform hover:scale-105 active:scale-95"
        >
          <Image
            src={search}
            alt=""
            style={{ width: s(ICON.search), height: s(ICON.search) }}
            className="max-w-none"
          />
        </button>
      </div>

      {/* Tasks — grab a row anywhere but its controls to reorder it. */}
      <ul
        style={{ rowGap: s(8) }}
        className={`flex flex-col ${
          mobile ? "sticker-scroll min-h-0 overflow-y-auto overscroll-contain" : ""
        }`}
      >
        {tasks.map((task, index) => {
          const lifted = dragRow === index;

          return (
            <li
              key={task.id}
              ref={(el) => {
                rowRefs.current[index] = el;
              }}
              onPointerDown={(event) => startRowDrag(event, index)}
              onPointerMove={onRowDrag}
              onPointerUp={endRowDrag}
              onPointerCancel={endRowDrag}
              style={{
                minHeight: s(46),
                borderRadius: s(12),
                padding: s(12),
                backgroundColor: task.color,
                borderWidth: s(0.32),
                touchAction: "none",
                transform: lifted
                  ? `translateY(${liftY}px) scale(1.05) rotate(-1.6deg)`
                  : `translateY(${rowShift(index)}px)`,
                boxShadow: lifted
                  ? `0 ${s(10)} ${s(18)} rgba(61,14,38,0.30)`
                  : `inset 0 ${s(1.29)} ${s(2.58)} rgba(211,162,102,0.55)`,
                // The lifted row must track the pointer with no easing; the
                // rows stepping aside are the ones that should glide.
                transition: lifted
                  ? "box-shadow 150ms ease-out"
                  : "transform 180ms cubic-bezier(0.2, 0, 0, 1)",
              }}
              className={`relative flex items-center justify-between border-black/10 ${
                lifted ? "z-20 cursor-grabbing" : "z-0 cursor-grab"
              }`}
            >
              <div
                style={{ columnGap: s(12) }}
                className="flex min-w-0 flex-1 items-center"
              >
                <button
                  type="button"
                  onClick={() => onToggleDone?.(task, !task.done)}
                  aria-label={`Mark ${task.label} as ${task.done ? "not done" : "done"}`}
                  aria-pressed={task.done}
                  style={{
                    width: s(ICON.check.w),
                    height: s(ICON.check.h),
                    borderWidth: s(1),
                  }}
                  className={`shrink-0 cursor-pointer rounded-full border-[#3d0e26] ${
                    task.done ? "bg-[#3d0e26]" : "bg-[#fffdf7]"
                  }`}
                />

                <div className="relative min-w-0 flex-1">
                  {editingId === task.id ? (
                    <input
                      autoFocus
                      value={editDraft}
                      onChange={(event) => setEditDraft(event.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitEdit();
                        if (event.key === "Escape") setEditingId(null);
                      }}
                      style={{ fontSize: s(16), lineHeight: s(19) }}
                      // Transparent and unpadded so the row colour carries
                      // through and the text does not shift on entering edit.
                      className="w-full min-w-0 bg-transparent text-black focus:outline-none"
                    />
                  ) : (
                    <span
                      style={{ fontSize: s(16), lineHeight: s(19) }}
                      // Two compact lines, then an ellipsis — a long task
                      // stays readable without one row swallowing the list.
                      className="line-clamp-2 text-black"
                    >
                      {task.label}
                    </span>
                  )}

                  {/* Completed tasks are scribbled out, the two passes drawn
                      one after the other so it reads as a hand crossing it off
                      rather than a line that was always there. Scoped to the
                      label so the scribble spans the row without tangling with
                      the bullet or the pencil and cross. */}
                  {task.done ? (
                    <svg
                      viewBox="0 0 200 20"
                      preserveAspectRatio="none"
                      fill="none"
                      aria-hidden
                      className="strike-wipe pointer-events-none absolute -inset-y-1 left-0 w-full"
                    >
                      <path
                        d="M2 13 C 34 4, 68 16, 100 7 S 166 15, 198 5"
                        stroke={INK}
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                      />
                      <path
                        d="M3 6 C 40 16, 78 4, 116 14 S 172 6, 197 15"
                        stroke={INK}
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        opacity="0.75"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                  ) : null}
                </div>
              </div>

              {/* Above the scribble, so a completed task stays actionable. */}
              <div
                style={{ columnGap: s(2) }}
                className="relative z-10 flex shrink-0 items-center"
              >
                {/*
                  A mini card with one square filled: this task is on the board.
                  Only shown when it is, so the rows that carry no mark are the
                  ones still to place.
                */}
                {onBoard.has(task.id) ? (
                  <span
                    title="On the board"
                    aria-label="On the board"
                    style={{ width: s(14), height: s(14), marginRight: s(4) }}
                    className="flex shrink-0 items-center justify-center"
                  >
                    <svg viewBox="0 0 12 12" fill="none" aria-hidden>
                      <rect
                        x="0.6"
                        y="0.6"
                        width="10.8"
                        height="10.8"
                        rx="2"
                        stroke={INK}
                        strokeWidth="1.1"
                      />
                      <rect x="4.2" y="4.2" width="3.6" height="3.6" rx="0.8" fill={INK} />
                    </svg>
                  </span>
                ) : null}

                {/* Pencil edits the task. */}
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(task.id);
                    setEditDraft(task.label);
                  }}
                  aria-label={`Edit ${task.label}`}
                  style={{ width: s(ICON.pencil.w), height: s(ICON.pencil.h) }}
                  className="flex cursor-pointer items-center justify-center transition-transform hover:scale-110 active:scale-95"
                >
                  <Image
                    src={pencil}
                    alt=""
                    style={{
                      width: s(ICON.pencil.w),
                      height: s(ICON.pencil.h),
                    }}
                    className="max-w-none"
                  />
                </button>

                {/* X removes the task. */}
                <button
                  type="button"
                  onClick={() => onDelete?.(task)}
                  aria-label={`Delete ${task.label}`}
                  style={{ width: s(ICON.cross), height: s(ICON.cross) }}
                  className="flex cursor-pointer items-center justify-center transition-transform hover:scale-110 active:scale-95"
                >
                  <Cross size={ICON.cross} color={INK} />
                </button>
              </div>

                          </li>
          );
        })}
      </ul>
    </section>
    </>
  );
}
