import type { BlockDef, Dow } from "./types.js";

/** Wake-shift plan. */
export const START_WAKE = 12 * 60; // realistic starting wake (12:00)
export const GOAL_WAKE = 9 * 60 + 30; // target wake (09:30)
export const SHIFT_STEP = 20; // minutes moved per phase
export const WEEKEND_WAKE_OFFSET = 60; // weekend wakes one hour later

/** Timezone display offsets (minutes). Schedule is authored in Armenia (UTC+4). */
export const TZ_DELTA: Record<"AM" | "TH", number> = { AM: 0, TH: 180 };

/** Fixed wall-clock commitments (minutes from midnight). */
const LESSON_ABS = 14 * 60; // 14:00 Armenian lesson (Mon/Wed/Fri)
const CALL_ABS = 20 * 60; // 20:00 Monday team call
const COOK_ABS = 18 * 60 + 30; // 18:30
const DINNER_ABS = 19 * 60; // 19:00
const WALK2_ABS = 19 * 60 + 30; // 19:30 (after dinner)
const DEEP2_ABS = 20 * 60; // 20:00
const FREE_ABS = 21 * 60 + 30; // 21:30

/** Block ids that count as "work" for work-hour accounting. */
export const WORK_IDS = new Set(["deep1", "work", "deep2", "call", "guard"]);
/** Block ids that act as containers tasks can be time-blocked into. */
export const FLEX_IDS = new Set(["deep1", "work", "deep2"]);

/** Weekday template. `hasLesson` pushes main work after the 14:00 lesson. */
export function weekdayBlocks(hasLesson: boolean): BlockDef[] {
  return [
    { id: "wake", off: 0, label: "Wake", type: "anchor", note: "Keep steady — the whole day hangs off it." },
    { id: "walk1", off: 0, label: "Walk 1 + daylight", type: "anchor", note: "Morning light is the circadian lever." },
    { id: "brk", off: 45, label: "Breakfast", type: "plain" },
    { id: "deep1", off: 75, label: "Deep block 1", type: "focus" },
    { id: "lunch", off: 210, label: "Lunch + rest", type: "plain" },
    { id: "work", off: hasLesson ? 330 : 270, label: "Main work", type: "focus" },
    { id: "cook", abs: COOK_ABS, label: "Cook dinner (30m)", type: "plain" },
    { id: "dinner", abs: DINNER_ABS, label: "Dinner", type: "plain" },
    { id: "walk2", abs: WALK2_ABS, label: "Walk 2 + dog training", type: "anchor", note: "After dinner." },
    { id: "deep2", abs: DEEP2_ABS, label: "Deep block 2", type: "focus" },
    { id: "free", abs: FREE_ABS, label: "Free time", type: "free", note: "Planned rest. No guilt." },
    { id: "wind", off: 840, label: "Dim lights + screens", type: "plain", note: "An hour before bed." },
    { id: "sleep", off: 900, label: "Bedtime", type: "anchor" },
  ];
}

/** Monday: main-job call replaces the evening deep block. */
export function mondayBlocks(): BlockDef[] {
  const b = weekdayBlocks(true).filter((x) => x.id !== "deep2");
  b.push({ id: "call", abs: CALL_ABS, label: "Team call", type: "call" });
  return b;
}

/** Weekend: wake later, one protected block, then a free day. */
export function weekendBlocks(): BlockDef[] {
  return [
    { id: "wake", off: 0, label: "Wake (+1h vs weekday)", type: "anchor" },
    { id: "walk1", off: 0, label: "Walk 1 + daylight", type: "anchor" },
    { id: "brk", off: 45, label: "Breakfast", type: "plain" },
    { id: "guard", off: 75, label: "Protected block (90m) before screens", type: "guard" },
    { id: "freed", off: 195, label: "Free day", type: "free" },
    { id: "cook", abs: COOK_ABS, label: "Cook dinner (30m)", type: "plain" },
    { id: "dinner", abs: DINNER_ABS, label: "Dinner", type: "plain" },
    { id: "walk2", abs: WALK2_ABS, label: "Walk 2 + dog", type: "anchor" },
    { id: "wind", off: 840, label: "Dim lights + screens", type: "plain" },
    { id: "sleep", off: 900, label: "Bedtime", type: "anchor" },
  ];
}

const LESSON_DOWS: ReadonlySet<Dow> = new Set<Dow>([0, 2, 4]);

/** Full block set for a given weekday, including fixed lesson on Mon/Wed/Fri. */
export function blocksForDow(dow: Dow): BlockDef[] {
  let raw: BlockDef[];
  if (dow === 0) raw = mondayBlocks();
  else if (dow >= 5) raw = weekendBlocks();
  else raw = weekdayBlocks(dow === 2 || dow === 4);

  if (LESSON_DOWS.has(dow)) {
    raw = raw.concat([
      { id: "arm", abs: LESSON_ABS, label: "Armenian lesson", type: "lesson", note: "1h, fixed." },
    ]);
  }
  return raw;
}
