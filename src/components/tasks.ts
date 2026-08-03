/**
 * The task list, shared by the to-do popup and anything that reads from it.
 *
 * It lives here rather than inside the popup because "Circle it back" spins a
 * wheel built from the same items — the list outlives whichever panel is open.
 */
export const ROW_COLORS = ["#fff68d", "#dff380", "#ffd4fd", "#93d1fc"];

export type Task = {
  id: number;
  label: string;
  done: boolean;
  color: string;
};

export const INITIAL_TASKS: Task[] = [1, 2, 3, 4].map((n) => ({
  id: n,
  label: `Tasks ${n}`,
  done: false,
  color: ROW_COLORS[(n - 1) % ROW_COLORS.length],
}));
