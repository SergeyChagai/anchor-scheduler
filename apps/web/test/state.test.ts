import { describe, it, expect } from "vitest";
import { GOAL_WAKE, START_WAKE, SHIFT_STEP } from "@anchor-scheduler/core";
import {
  STORAGE_KEY,
  addDays,
  addTask,
  dowOf,
  initialState,
  load,
  migrate,
  nudgeWake,
  removeTask,
  save,
  toISODate,
  toggleCheck,
  toggleTask,
} from "../src/state.js";

/** Enough of the Storage interface for load/save. */
function memoryStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

describe("dates", () => {
  it("uses the local calendar day, not UTC", () => {
    // 23:30 local on the 9th is still the 9th, whatever UTC thinks
    expect(toISODate(new Date(2026, 7, 9, 23, 30))).toBe("2026-08-09");
  });

  it("maps ISO dates to the engine's Monday-based day of week", () => {
    expect(dowOf("2026-08-10")).toBe(0); // Monday
    expect(dowOf("2026-08-09")).toBe(6); // Sunday
  });

  it("steps across month boundaries", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-09-01", -1)).toBe("2026-08-31");
  });
});

describe("persistence", () => {
  it("round-trips through storage", () => {
    const storage = memoryStorage();
    const state = addTask(initialState(), "write the sync ADR", 90);
    save(storage, state);
    expect(load(storage)).toEqual(state);
  });

  it("falls back to defaults on missing or corrupt data", () => {
    expect(load(memoryStorage())).toEqual(initialState());
    expect(load(memoryStorage({ [STORAGE_KEY]: "{not json" }))).toEqual(initialState());
  });

  it("keeps a half-valid payload's good parts and drops the rest", () => {
    const restored = migrate({
      wakeMin: 99999,
      tz: "XX",
      tasks: [
        { id: "ok", title: "real", estimateMin: 30, status: "todo" },
        { id: "bad", title: 7 },
      ],
      checks: { "2026-08-09": { wake: true, walk1: "yes" } },
    });
    expect(restored.wakeMin).toBe(START_WAKE); // clamped onto the ladder
    expect(restored.tz).toBe("AM");
    expect(restored.tasks.map((t) => t.id)).toEqual(["ok"]);
    expect(restored.checks["2026-08-09"]).toEqual({ wake: true });
  });
});

describe("mutations", () => {
  it("toggles a block check per day, leaving other days alone", () => {
    let s = initialState();
    s = toggleCheck(s, "2026-08-09", "wake");
    expect(s.checks["2026-08-09"].wake).toBe(true);
    expect(s.checks["2026-08-10"]).toBeUndefined();
    s = toggleCheck(s, "2026-08-09", "wake");
    expect(s.checks["2026-08-09"].wake).toBe(false);
  });

  it("walks the wake ladder and stops at the goal", () => {
    let s = initialState();
    expect(s.wakeMin).toBe(START_WAKE);
    s = nudgeWake(s, -1);
    expect(s.wakeMin).toBe(START_WAKE - SHIFT_STEP);
    for (let i = 0; i < 20; i++) s = nudgeWake(s, -1);
    expect(s.wakeMin).toBe(GOAL_WAKE);
  });

  it("adds, toggles and removes tasks", () => {
    let s = addTask(initialState(), "  ship the web surface  ", 45);
    expect(s.tasks[0].title).toBe("ship the web surface");
    s = toggleTask(s, s.tasks[0].id);
    expect(s.tasks[0].status).toBe("done");
    s = removeTask(s, s.tasks[0].id);
    expect(s.tasks).toEqual([]);
  });

  it("ignores empty titles and floors silly estimates", () => {
    expect(addTask(initialState(), "   ", 30).tasks).toEqual([]);
    expect(addTask(initialState(), "tiny", 1).tasks[0].estimateMin).toBe(5);
  });
});
