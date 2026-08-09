import type { BlockDef, ComputedBlock, Dow, EngineConfig } from "./types.js";
import {
  blocksForDow,
  GOAL_WAKE,
  SHIFT_STEP,
  START_WAKE,
  TZ_DELTA,
  WEEKEND_WAKE_OFFSET,
  WORK_IDS,
} from "./blocks.js";

/** Minutes-from-midnight -> "HH:MM", wrapping across midnight. */
export function fmt(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  return (
    String(Math.floor(m / 60)).padStart(2, "0") +
    ":" +
    String(m % 60).padStart(2, "0")
  );
}

/**
 * The wake-shift ladder: every wake time the plan passes through, earliest
 * first (GOAL_WAKE ... START_WAKE). The user moves one rung at a time rather
 * than jumping straight to the goal.
 *
 * Built downward from START_WAKE, so the goal is always the final rung even
 * when the span is not a whole number of steps (12:00 → 09:30 is 150m at a
 * 20m step, so the last move is a short one).
 */
export function wakePhases(): number[] {
  const out: number[] = [];
  for (let w = START_WAKE; w > GOAL_WAKE; w -= SHIFT_STEP) out.push(w);
  out.push(GOAL_WAKE);
  return out.reverse();
}

/** Snap a wake time onto the nearest rung of the ladder, clamped to its ends. */
export function clampWake(wakeMin: number): number {
  return wakePhases().reduce((best, rung) =>
    Math.abs(rung - wakeMin) < Math.abs(best - wakeMin) ? rung : best,
  );
}

/** Move one rung along the ladder: -1 = earlier (toward the goal), +1 = later. */
export function shiftWake(wakeMin: number, direction: -1 | 1): number {
  const phases = wakePhases();
  const i = phases.indexOf(clampWake(wakeMin));
  return phases[Math.min(phases.length - 1, Math.max(0, i + direction))];
}

/** How far along the shift plan the user is, 0 (start) .. 1 (goal reached). */
export function wakeProgress(wakeMin: number): number {
  const span = START_WAKE - GOAL_WAKE;
  return (START_WAKE - clampWake(wakeMin)) / span;
}

/** Wake time for a given day (weekends wake one hour later). */
export function baseWake(dow: Dow, wakeMin: number): number {
  return dow >= 5 ? wakeMin + WEEKEND_WAKE_OFFSET : wakeMin;
}

/** Resolve a block's offset-from-wake, whether it is offset- or clock-pinned. */
function resolveOffset(b: BlockDef, wake: number): number {
  if (b.abs != null) return (((b.abs - wake) % 1440) + 1440) % 1440;
  return b.off ?? 0;
}

/**
 * Compute the concrete schedule for a day.
 * Blocks are ordered by their offset from wake; the timezone shift is applied
 * only to the displayed clock, so ordering is preserved across zones.
 */
export function computeDay(dow: Dow, cfg: EngineConfig): ComputedBlock[] {
  const wake = baseWake(dow, cfg.wakeMin);
  const delta = TZ_DELTA[cfg.tz];
  return blocksForDow(dow)
    .map((b) => {
      const offset = resolveOffset(b, wake);
      return {
        ...b,
        offset,
        start: (((wake + offset + delta) % 1440) + 1440) % 1440,
        clock: fmt(wake + offset + delta),
      };
    })
    .sort((a, b) => a.offset - b.offset);
}

/** Absolute minutes for a clock time, treating pre-05:00 as "late night". */
function nightAdjusted(startMin: number): number {
  return startMin < 300 ? startMin + 1440 : startMin;
}

/**
 * Total work minutes for a day. Each block runs until the next one starts;
 * we sum the durations of blocks whose id is a work id.
 */
export function workMinutes(dow: Dow, cfg: EngineConfig): number {
  const list = computeDay(dow, cfg);
  let total = 0;
  for (let i = 0; i < list.length - 1; i++) {
    const cur = list[i];
    const dur =
      nightAdjusted(list[i + 1].start) - nightAdjusted(cur.start);
    if (WORK_IDS.has(cur.id)) total += dur;
  }
  return total;
}

export function workHours(dow: Dow, cfg: EngineConfig): number {
  return Math.round((workMinutes(dow, cfg) / 60) * 100) / 100;
}

/** A day is "complete" when all its anchors are checked. */
export function anchorsComplete(
  blocks: ComputedBlock[],
  checks: Record<string, boolean>,
): boolean {
  const anchors = blocks.filter((b) => b.type === "anchor");
  if (anchors.length === 0) return blocks.every((b) => checks[b.id]);
  return anchors.every((b) => checks[b.id]);
}

/** Detect hard overlaps among fixed-duration blocks (cook/dinner/walk2/lesson/call). */
const FIXED_DUR: Record<string, number> = {
  cook: 30,
  dinner: 30,
  walk2: 30,
  arm: 60,
  call: 60,
};

export function fixedOverlaps(dow: Dow, cfg: EngineConfig): string[] {
  const fixed = computeDay(dow, cfg)
    .filter((b) => FIXED_DUR[b.id] != null)
    .map((b) => ({
      id: b.id,
      s: nightAdjusted(b.start),
      e: nightAdjusted(b.start) + FIXED_DUR[b.id],
    }))
    .sort((a, b) => a.s - b.s);
  const clashes: string[] = [];
  for (let i = 0; i < fixed.length - 1; i++) {
    if (fixed[i].e > fixed[i + 1].s) {
      clashes.push(`${fixed[i].id} x ${fixed[i + 1].id}`);
    }
  }
  return clashes;
}
