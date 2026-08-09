import { describe, it, expect } from "vitest";
import { GOAL_WAKE } from "@anchor-scheduler/core";
import { addTask, initialState, toggleCheck, type AppState } from "../src/state.js";
import { buildDayView, humanMin, shortDate } from "../src/view.js";

/** Tuesday 11 Aug 2026, at the goal wake. */
const TUE = "2026-08-11";
const base = (): AppState => ({ ...initialState(), wakeMin: GOAL_WAKE });
const view = (s: AppState, date = TUE) => buildDayView(s, date, TUE, []);

describe("buildDayView", () => {
  it("labels the day and flags whether it is today", () => {
    expect(view(base()).dowName).toBe("Tuesday");
    expect(view(base()).isToday).toBe(true);
    expect(view(base(), "2026-08-12").isToday).toBe(false);
  });

  it("attaches planned tasks to the focus block they were blocked into", () => {
    let s = base();
    s = addTask(s, "long thing", 120);
    s = addTask(s, "short thing", 60);
    const rows = view(s).rows;
    const deep1 = rows.find((r) => r.block.id === "deep1")!;
    const work = rows.find((r) => r.block.id === "work")!;
    expect(deep1.planned.map((p) => p.task.title)).toEqual(["long thing"]);
    expect(work.planned.map((p) => p.task.title)).toEqual(["short thing"]);
  });

  it("reports focus capacity used against what the day offers", () => {
    const s = addTask(base(), "one", 90);
    expect(view(s).usedMin).toBe(90);
    expect(view(s).capacityMin).toBe(495);
  });

  it("surfaces tasks that fit in no window", () => {
    const s = addTask(base(), "impossible", 600);
    expect(view(s).unplaced.map((t) => t.title)).toEqual(["impossible"]);
  });

  it("counts anchors and calls the day complete only when all are checked", () => {
    let s = base();
    const anchors = view(s).rows.filter((r) => r.block.type === "anchor");
    expect(view(s).anchorsTotal).toBe(anchors.length);
    expect(view(s).dayComplete).toBe(false);

    for (const r of anchors) s = toggleCheck(s, TUE, r.block.id);
    expect(view(s).anchorsDone).toBe(anchors.length);
    expect(view(s).dayComplete).toBe(true);
  });

  it("keeps checks scoped to their own day", () => {
    const s = toggleCheck(base(), TUE, "wake");
    expect(view(s).anchorsDone).toBe(1);
    expect(view(s, "2026-08-12").anchorsDone).toBe(0);
  });
});

describe("formatting", () => {
  it("renders durations and dates compactly", () => {
    expect(humanMin(45)).toBe("45m");
    expect(humanMin(120)).toBe("2h");
    expect(humanMin(135)).toBe("2h 15m");
    expect(shortDate("2026-08-09")).toBe("9 Aug");
  });
});
