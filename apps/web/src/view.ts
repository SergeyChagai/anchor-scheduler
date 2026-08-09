/**
 * View model: everything the UI needs for one day, derived from state + the
 * engine. Pure — no DOM — so the numbers on screen are testable.
 */
import {
  anchorsComplete,
  computeDay,
  flexCapacity,
  fmt,
  planTasks,
  wakeProgress,
  workHours,
  type Assignment,
  type ComputedBlock,
  type Task,
  type Tz,
} from "@anchor-scheduler/core";
import { checksFor, dowOf, parseISODate, type AppState } from "./state.js";

const DOW_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export interface PlannedTask {
  task: Task;
  assignment: Assignment;
}

export interface TimelineRow {
  block: ComputedBlock;
  checked: boolean;
  /** tasks time-blocked into this block (focus containers only) */
  planned: PlannedTask[];
}

export interface DayView {
  dateISO: string;
  dowName: string;
  isToday: boolean;
  tz: Tz;
  wakeClock: string;
  /** 0 at the starting wake, 1 once the goal wake is reached */
  shiftProgress: number;
  workHours: number;
  rows: TimelineRow[];
  anchorsDone: number;
  anchorsTotal: number;
  dayComplete: boolean;
  /** minutes of focus capacity the plan consumes, and what the day offers */
  usedMin: number;
  capacityMin: number;
  unplaced: Task[];
  overlaps: string[];
}

export function buildDayView(
  state: AppState,
  dateISO: string,
  todayISO: string,
  overlaps: string[],
): DayView {
  const dow = dowOf(dateISO);
  const cfg = { wakeMin: state.wakeMin, tz: state.tz };
  const blocks = computeDay(dow, cfg);
  const checks = checksFor(state, dateISO);
  const { assignments, unplaced } = planTasks(state.tasks, dow, cfg, dateISO);

  const byId = new Map(state.tasks.map((t) => [t.id, t]));
  const rows: TimelineRow[] = blocks.map((block) => ({
    block,
    checked: !!checks[block.id],
    planned: assignments
      .filter((a) => a.blockId === block.id)
      .map((a) => ({ task: byId.get(a.taskId)!, assignment: a }))
      .filter((p) => !!p.task),
  }));

  const anchors = blocks.filter((b) => b.type === "anchor");

  return {
    dateISO,
    dowName: DOW_NAMES[dow],
    isToday: dateISO === todayISO,
    tz: state.tz,
    wakeClock: fmt(state.wakeMin),
    shiftProgress: wakeProgress(state.wakeMin),
    workHours: workHours(dow, cfg),
    rows,
    anchorsDone: anchors.filter((b) => checks[b.id]).length,
    anchorsTotal: anchors.length,
    dayComplete: anchorsComplete(blocks, checks),
    usedMin: assignments.reduce((sum, a) => sum + a.durationMin, 0),
    capacityMin: flexCapacity(dow, cfg),
    unplaced,
    overlaps,
  };
}

/** "9 Aug" — short, unambiguous, locale-independent. */
export function shortDate(iso: string): string {
  const d = parseISODate(iso);
  const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

/** "2h 15m" / "45m" */
export function humanMin(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
