/**
 * Core domain types for the anchor-based day scheduler.
 *
 * The model is deliberately small: a day is a set of blocks, each pinned
 * either to the wake time (offset) or to the wall clock (absolute). Anchors
 * are the fixed points the user keeps every day; everything else hangs off
 * them. Tasks are time-blocked into the flexible ("focus") containers.
 */

/** Day of week, Monday-based: 0 = Mon ... 6 = Sun. */
export type Dow = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Timezone the user is physically in. Schedule is authored in AM (body clock). */
export type Tz = "AM" | "TH";

export type BlockType =
  | "anchor" // fixed daily point (wake, walks, bedtime)
  | "focus" // deep-work container that tasks get scheduled into
  | "free" // intentional rest
  | "call" // external meeting (fixed clock)
  | "lesson" // external commitment (fixed clock)
  | "guard" // weekend protected block
  | "plain";

/**
 * A block definition. Exactly one of `off` or `abs` positions it:
 *  - `off`: minutes after wake (slides as wake shifts)
 *  - `abs`: minutes from midnight (fixed to the wall clock)
 */
export interface BlockDef {
  id: string;
  label: string;
  type: BlockType;
  off?: number;
  abs?: number;
  note?: string;
}

/** A block resolved to concrete times for a given wake/timezone. */
export interface ComputedBlock extends BlockDef {
  /** minutes after (base) wake, before timezone shift — used for ordering */
  offset: number;
  /** minutes from midnight, timezone-adjusted, wrapped to 0..1439 */
  start: number;
  /** "HH:MM" */
  clock: string;
}

export interface EngineConfig {
  /** wake time in minutes from midnight (body clock) */
  wakeMin: number;
  tz: Tz;
}

export interface Task {
  id: string;
  title: string;
  estimateMin: number;
  status: "todo" | "done";
}

export interface Assignment {
  taskId: string;
  dateISO: string;
  /** the focus block the task was time-blocked into */
  blockId: string;
  startMin: number;
  durationMin: number;
}

export interface FlexWindow {
  blockId: string;
  start: number; // minutes from midnight
  end: number;
}
