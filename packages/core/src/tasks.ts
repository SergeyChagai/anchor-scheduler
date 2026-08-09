import type {
  Assignment,
  Dow,
  EngineConfig,
  FlexWindow,
  Task,
} from "./types.js";
import { computeDay } from "./engine.js";
import { FLEX_IDS } from "./blocks.js";

function nightAdjusted(startMin: number): number {
  return startMin < 300 ? startMin + 1440 : startMin;
}

/**
 * The flexible windows a day offers for time-blocking tasks: the focus
 * containers (deep blocks + main work). Each runs until the next block starts.
 */
export function flexWindows(dow: Dow, cfg: EngineConfig): FlexWindow[] {
  const list = computeDay(dow, cfg);
  const out: FlexWindow[] = [];
  for (let i = 0; i < list.length - 1; i++) {
    const cur = list[i];
    if (!FLEX_IDS.has(cur.id)) continue;
    out.push({
      blockId: cur.id,
      start: cur.start,
      end: cur.start + (nightAdjusted(list[i + 1].start) - nightAdjusted(cur.start)),
    });
  }
  return out;
}

export interface PlanResult {
  assignments: Assignment[];
  unplaced: Task[];
}

/**
 * Greedily place todo tasks into the day's flex windows, in order, first-fit.
 * A task is placed whole (no splitting); anything that doesn't fit is returned
 * as `unplaced` so the UI can surface "no room today".
 */
export function planTasks(
  tasks: Task[],
  dow: Dow,
  cfg: EngineConfig,
  dateISO: string,
): PlanResult {
  const windows = flexWindows(dow, cfg).map((w) => ({ ...w, cursor: w.start }));
  const assignments: Assignment[] = [];
  const unplaced: Task[] = [];

  for (const task of tasks) {
    if (task.status === "done") continue;
    const win = windows.find((w) => w.end - w.cursor >= task.estimateMin);
    if (!win) {
      unplaced.push(task);
      continue;
    }
    assignments.push({
      taskId: task.id,
      dateISO,
      blockId: win.blockId,
      startMin: win.cursor,
      durationMin: task.estimateMin,
    });
    win.cursor += task.estimateMin;
  }
  return { assignments, unplaced };
}

/** Total free capacity (minutes) across a day's flex windows. */
export function flexCapacity(dow: Dow, cfg: EngineConfig): number {
  return flexWindows(dow, cfg).reduce((sum, w) => sum + (w.end - w.start), 0);
}
