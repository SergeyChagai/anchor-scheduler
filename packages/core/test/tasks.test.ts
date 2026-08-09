import { describe, it, expect } from "vitest";
import {
  flexWindows,
  flexCapacity,
  planTasks,
  GOAL_WAKE,
  type EngineConfig,
  type Task,
} from "../src/index.js";

const AM = (wakeMin: number): EngineConfig => ({ wakeMin, tz: "AM" });
const t = (id: string, estimateMin: number): Task => ({
  id,
  title: id,
  estimateMin,
  status: "todo",
});

describe("flexWindows", () => {
  it("exposes the focus containers (deep1, work, deep2) as schedulable windows", () => {
    const ids = flexWindows(1, AM(GOAL_WAKE)).map((w) => w.blockId);
    expect(ids).toEqual(["deep1", "work", "deep2"]);
  });

  it("reports total capacity of the day's focus windows", () => {
    // Tue @ 09:30: deep1 135m + work 270m + deep2 90m
    expect(flexCapacity(1, AM(GOAL_WAKE))).toBe(495);
  });
});

describe("planTasks", () => {
  it("first-fits todo tasks into windows and records start times", () => {
    const { assignments, unplaced } = planTasks(
      [t("a", 90), t("b", 60), t("c", 200)],
      1,
      AM(GOAL_WAKE),
      "2026-08-11",
    );
    expect(unplaced).toEqual([]);
    expect(assignments).toHaveLength(3);
    // first task lands at the start of deep1 (10:45 = 645)
    expect(assignments[0]).toMatchObject({
      taskId: "a",
      blockId: "deep1",
      startMin: 645,
      durationMin: 90,
    });
  });

  it("records which focus block each task was placed into", () => {
    // deep1 holds 135m: 120m fits, the next 60m task spills into main work
    const { assignments } = planTasks(
      [t("a", 120), t("b", 60)],
      1,
      AM(GOAL_WAKE),
      "2026-08-11",
    );
    expect(assignments.map((a) => a.blockId)).toEqual(["deep1", "work"]);
  });

  it("returns tasks that fit in no single window as unplaced", () => {
    const { assignments, unplaced } = planTasks(
      [t("huge", 300)], // larger than the biggest window (work = 270m)
      1,
      AM(GOAL_WAKE),
      "2026-08-11",
    );
    expect(assignments).toEqual([]);
    expect(unplaced.map((x) => x.id)).toEqual(["huge"]);
  });

  it("skips already-done tasks", () => {
    const done: Task = { id: "d", title: "d", estimateMin: 30, status: "done" };
    const { assignments } = planTasks([done], 1, AM(GOAL_WAKE), "2026-08-11");
    expect(assignments).toEqual([]);
  });
});
