import { describe, it, expect } from "vitest";
import {
  fmt,
  computeDay,
  workHours,
  anchorsComplete,
  fixedOverlaps,
  wakePhases,
  clampWake,
  shiftWake,
  wakeProgress,
  START_WAKE,
  GOAL_WAKE,
  SHIFT_STEP,
  type Dow,
  type EngineConfig,
} from "../src/index.js";

const AM = (wakeMin: number): EngineConfig => ({ wakeMin, tz: "AM" });
const clockOf = (dow: Dow, cfg: EngineConfig, id: string) =>
  computeDay(dow, cfg).find((b) => b.id === id)!.clock;

describe("fmt", () => {
  it("wraps across midnight", () => {
    expect(fmt(1470)).toBe("00:30");
    expect(fmt(-30)).toBe("23:30");
    expect(fmt(570)).toBe("09:30");
  });
});

describe("computeDay — fixed evening at the goal wake (09:30)", () => {
  it("keeps dinner, walk-after-dinner and the Monday call on the wall clock", () => {
    expect(clockOf(0, AM(GOAL_WAKE), "dinner")).toBe("19:00");
    expect(clockOf(0, AM(GOAL_WAKE), "walk2")).toBe("19:30");
    expect(clockOf(0, AM(GOAL_WAKE), "call")).toBe("20:00");
  });

  it("orders blocks chronologically by offset from wake", () => {
    const starts = computeDay(1, AM(GOAL_WAKE)).map((b) => b.offset);
    const sorted = [...starts].sort((a, b) => a - b);
    expect(starts).toEqual(sorted);
  });
});

describe("workHours", () => {
  it("full days hit ~8h, lesson days are lighter, weekends are protected-only", () => {
    expect(workHours(1, AM(GOAL_WAKE))).toBe(8.25); // Tue (no lesson)
    expect(workHours(3, AM(GOAL_WAKE))).toBe(8.25); // Thu
    expect(workHours(2, AM(GOAL_WAKE))).toBe(7.25); // Wed (lesson)
    expect(workHours(0, AM(GOAL_WAKE))).toBe(7.25); // Mon (lesson + call)
    expect(workHours(5, AM(GOAL_WAKE))).toBe(2); // Sat
  });

  it("compresses at the late starting wake (12:00)", () => {
    // late wake against a fixed 19:00 dinner leaves a shorter productive day
    expect(workHours(1, AM(START_WAKE))).toBeLessThan(workHours(1, AM(GOAL_WAKE)));
  });
});

describe("timezone calibration", () => {
  it("shifts every displayed clock by +3h in Thailand", () => {
    expect(clockOf(1, { wakeMin: GOAL_WAKE, tz: "TH" }, "wake")).toBe("12:30");
    expect(clockOf(0, { wakeMin: GOAL_WAKE, tz: "TH" }, "call")).toBe("23:00");
  });
});

describe("fixedOverlaps", () => {
  it("never double-books a fixed block on any day across every shift phase", () => {
    for (let w = GOAL_WAKE; w <= START_WAKE; w += 20) {
      for (let d = 0 as Dow; d <= 6; d = (d + 1) as Dow) {
        expect(fixedOverlaps(d, AM(w))).toEqual([]);
      }
    }
  });
});

describe("wake-shift ladder", () => {
  it("spans start to goal, stepping by SHIFT_STEP from the start", () => {
    const phases = wakePhases();
    expect(phases[0]).toBe(GOAL_WAKE);
    expect(phases[phases.length - 1]).toBe(START_WAKE);
    expect(phases[phases.length - 1] - phases[phases.length - 2]).toBe(SHIFT_STEP);
  });

  it("lands exactly on the goal even though the span is not a whole number of steps", () => {
    // 12:00 -> 09:30 is 150m at a 20m step: the final move is a short one
    expect((START_WAKE - GOAL_WAKE) % SHIFT_STEP).not.toBe(0);
    expect(wakePhases()).toContain(GOAL_WAKE);
    expect(wakePhases()[1] - GOAL_WAKE).toBeLessThan(SHIFT_STEP);
  });

  it("snaps arbitrary wake times onto the nearest rung and clamps at both ends", () => {
    expect(clampWake(GOAL_WAKE + 3)).toBe(GOAL_WAKE);
    expect(clampWake(START_WAKE - 3)).toBe(START_WAKE);
    expect(clampWake(GOAL_WAKE - 60)).toBe(GOAL_WAKE);
    expect(clampWake(START_WAKE + 60)).toBe(START_WAKE);
    expect(wakePhases()).toContain(clampWake(11 * 60 + 7));
  });

  it("moves one rung at a time and refuses to leave the ladder", () => {
    expect(shiftWake(START_WAKE, -1)).toBe(START_WAKE - SHIFT_STEP);
    expect(shiftWake(GOAL_WAKE, -1)).toBe(GOAL_WAKE);
    expect(shiftWake(START_WAKE, 1)).toBe(START_WAKE);
  });

  it("reports progress from 0 at the start to 1 at the goal", () => {
    expect(wakeProgress(START_WAKE)).toBe(0);
    expect(wakeProgress(GOAL_WAKE)).toBe(1);
    expect(wakeProgress(START_WAKE - SHIFT_STEP)).toBeGreaterThan(0);
  });
});

describe("anchorsComplete", () => {
  it("is true once every anchor is checked, regardless of other blocks", () => {
    const day = computeDay(1, AM(GOAL_WAKE));
    const checks: Record<string, boolean> = {};
    for (const b of day) if (b.type === "anchor") checks[b.id] = true;
    expect(anchorsComplete(day, checks)).toBe(true);

    const someAnchor = day.find((b) => b.type === "anchor")!.id;
    checks[someAnchor] = false;
    expect(anchorsComplete(day, checks)).toBe(false);
  });
});
