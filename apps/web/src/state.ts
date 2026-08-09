/**
 * Local-first app state: everything lives in localStorage, nothing leaves the
 * device. The mutation helpers are pure (state in, state out) so they can be
 * tested without a DOM and swapped for a synced store later.
 */
import {
  GOAL_WAKE,
  START_WAKE,
  clampWake,
  shiftWake,
  type Dow,
  type Task,
  type Tz,
} from "@anchor-scheduler/core";

export const STORAGE_KEY = "anchor-scheduler/v1";

export interface AppState {
  version: 1;
  /** current rung of the wake-shift ladder (body clock, minutes from midnight) */
  wakeMin: number;
  tz: Tz;
  tasks: Task[];
  /** dateISO -> blockId -> checked */
  checks: Record<string, Record<string, boolean>>;
}

export function initialState(): AppState {
  return { version: 1, wakeMin: START_WAKE, tz: "AM", tasks: [], checks: {} };
}

/** "YYYY-MM-DD" in local time (not UTC — the day you are living in). */
export function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Monday-based day of week for an ISO date, matching the engine's `Dow`. */
export function dowOf(iso: string): Dow {
  return ((parseISODate(iso).getDay() + 6) % 7) as Dow;
}

export function addDays(iso: string, delta: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + delta);
  return toISODate(d);
}

/**
 * Accept only what we recognise. A half-written or older payload falls back to
 * defaults field by field rather than throwing the whole day away.
 */
export function migrate(raw: unknown): AppState {
  const base = initialState();
  if (typeof raw !== "object" || raw === null) return base;
  const src = raw as Partial<AppState>;

  const wakeMin =
    typeof src.wakeMin === "number" && Number.isFinite(src.wakeMin)
      ? clampWake(src.wakeMin)
      : base.wakeMin;

  const tasks = Array.isArray(src.tasks)
    ? src.tasks.filter(
        (t): t is Task =>
          !!t &&
          typeof t.id === "string" &&
          typeof t.title === "string" &&
          typeof t.estimateMin === "number" &&
          (t.status === "todo" || t.status === "done"),
      )
    : base.tasks;

  const checks: AppState["checks"] = {};
  if (src.checks && typeof src.checks === "object") {
    for (const [date, marks] of Object.entries(src.checks)) {
      if (!marks || typeof marks !== "object") continue;
      checks[date] = {};
      for (const [id, on] of Object.entries(marks)) {
        if (typeof on === "boolean") checks[date][id] = on;
      }
    }
  }

  return {
    version: 1,
    wakeMin,
    tz: src.tz === "TH" ? "TH" : "AM",
    tasks,
    checks,
  };
}

export function load(storage: Storage): AppState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? migrate(JSON.parse(raw)) : initialState();
  } catch {
    return initialState();
  }
}

export function save(storage: Storage, state: AppState): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked (private mode): the session still works in memory.
  }
}

/* -------------------------------------------------------------------------- */
/* Mutations — pure                                                            */
/* -------------------------------------------------------------------------- */

export function toggleCheck(
  state: AppState,
  dateISO: string,
  blockId: string,
): AppState {
  const day = state.checks[dateISO] ?? {};
  return {
    ...state,
    checks: { ...state.checks, [dateISO]: { ...day, [blockId]: !day[blockId] } },
  };
}

export function checksFor(state: AppState, dateISO: string): Record<string, boolean> {
  return state.checks[dateISO] ?? {};
}

export function setTz(state: AppState, tz: Tz): AppState {
  return { ...state, tz };
}

/** Move one rung along the wake-shift ladder. */
export function nudgeWake(state: AppState, direction: -1 | 1): AppState {
  return { ...state, wakeMin: shiftWake(state.wakeMin, direction) };
}

export function addTask(state: AppState, title: string, estimateMin: number): AppState {
  const clean = title.trim();
  if (!clean) return state;
  const task: Task = {
    id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    title: clean,
    estimateMin: Math.max(5, Math.round(estimateMin)),
    status: "todo",
  };
  return { ...state, tasks: [...state.tasks, task] };
}

export function toggleTask(state: AppState, id: string): AppState {
  return {
    ...state,
    tasks: state.tasks.map((t) =>
      t.id === id ? { ...t, status: t.status === "done" ? "todo" : "done" } : t,
    ),
  };
}

export function removeTask(state: AppState, id: string): AppState {
  return { ...state, tasks: state.tasks.filter((t) => t.id !== id) };
}

/** Label for the current rung, e.g. "12:00 → 09:30" progress readout. */
export const WAKE_BOUNDS = { start: START_WAKE, goal: GOAL_WAKE };
