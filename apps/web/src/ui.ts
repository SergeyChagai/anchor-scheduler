/**
 * DOM rendering. Deliberately framework-free: the app is a list, a few
 * checkboxes and a form, and the whole view is cheap to rebuild from scratch.
 */
import { fmt, type BlockType, type Tz } from "@anchor-scheduler/core";
import { humanMin, shortDate, type DayView, type TimelineRow } from "./view.js";

export interface Actions {
  shiftDay(delta: number): void;
  goToday(): void;
  nudgeWake(direction: -1 | 1): void;
  setTz(tz: Tz): void;
  toggleCheck(blockId: string): void;
  addTask(title: string, estimateMin: number): void;
  toggleTask(id: string): void;
  removeTask(id: string): void;
}

type Child = Node | string | null | undefined | false | Child[];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === "class") node.className = String(v);
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (k in node) (node as Record<string, unknown>)[k] = v;
    else node.setAttribute(k, String(v));
  }
  append(node, children);
  return node;
}

function append(node: HTMLElement, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(node, c);
    else node.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

const TYPE_LABEL: Partial<Record<BlockType, string>> = {
  anchor: "anchor",
  focus: "focus",
  free: "rest",
  call: "call",
  lesson: "fixed",
  guard: "protected",
};

/* -------------------------------------------------------------------------- */

function renderHeader(v: DayView, a: Actions): HTMLElement {
  return el(
    "header",
    { class: "topbar" },
    el(
      "div",
      { class: "daynav" },
      el("button", { class: "icon", title: "Previous day", onClick: () => a.shiftDay(-1) }, "‹"),
      el(
        "div",
        { class: "daynav-label" },
        el("h1", {}, v.dowName),
        el("p", { class: "muted" }, shortDate(v.dateISO), v.isToday ? " · today" : ""),
      ),
      el("button", { class: "icon", title: "Next day", onClick: () => a.shiftDay(1) }, "›"),
      !v.isToday && el("button", { class: "ghost", onClick: () => a.goToday() }, "Today"),
    ),
    el(
      "div",
      { class: "controls" },
      el(
        "div",
        { class: "control" },
        el("span", { class: "control-label" }, "Wake"),
        el(
          "div",
          { class: "stepper" },
          el("button", { class: "icon", title: "20 minutes earlier", onClick: () => a.nudgeWake(-1) }, "−"),
          el("strong", {}, v.wakeClock),
          el("button", { class: "icon", title: "20 minutes later", onClick: () => a.nudgeWake(1) }, "+"),
        ),
        el(
          "div",
          { class: "progress", title: "Progress along the wake-shift plan" },
          el("i", { style: `width:${Math.round(v.shiftProgress * 100)}%` }),
        ),
      ),
      el(
        "div",
        { class: "control" },
        el("span", { class: "control-label" }, "Timezone"),
        el(
          "div",
          { class: "segmented" },
          (["AM", "TH"] as Tz[]).map((tz) =>
            el(
              "button",
              { class: tz === v.tz ? "seg on" : "seg", onClick: () => a.setTz(tz) },
              tz === "AM" ? "Armenia" : "Thailand",
            ),
          ),
        ),
      ),
      el(
        "div",
        { class: "control stats" },
        el("span", { class: "control-label" }, "Day"),
        el("strong", {}, `${v.workHours}h work`),
        el("span", { class: "muted" }, `${v.anchorsDone}/${v.anchorsTotal} anchors`),
      ),
    ),
  );
}

function renderRow(row: TimelineRow, a: Actions): HTMLElement {
  const b = row.block;
  const badge = TYPE_LABEL[b.type];
  return el(
    "li",
    { class: `row row-${b.type}${row.checked ? " done" : ""}` },
    el("span", { class: "clock" }, b.clock),
    el(
      "div",
      { class: "row-body" },
      el(
        "div",
        { class: "row-head" },
        b.type === "anchor"
          ? el(
              "label",
              { class: "check" },
              el("input", {
                type: "checkbox",
                checked: row.checked,
                onChange: () => a.toggleCheck(b.id),
              }),
              el("span", {}, b.label),
            )
          : el("span", { class: "label" }, b.label),
        badge && el("span", { class: `badge badge-${b.type}` }, badge),
      ),
      b.note && el("p", { class: "note" }, b.note),
      row.planned.length > 0 &&
        el(
          "ul",
          { class: "planned" },
          row.planned.map((p) =>
            el(
              "li",
              { class: p.task.status === "done" ? "planned-item done" : "planned-item" },
              el("span", { class: "clock small" }, fmt(p.assignment.startMin)),
              el("span", {}, p.task.title),
              el("span", { class: "muted" }, humanMin(p.assignment.durationMin)),
            ),
          ),
        ),
    ),
  );
}

function renderTimeline(v: DayView, a: Actions): HTMLElement {
  return el(
    "section",
    { class: "timeline" },
    v.dayComplete &&
      el("p", { class: "banner ok" }, "Anchors done. The day counts — the rest is bonus."),
    v.overlaps.length > 0 &&
      el(
        "p",
        { class: "banner warn" },
        `Fixed blocks collide: ${v.overlaps.join(", ")}`,
      ),
    el("ul", { class: "rows" }, v.rows.map((r) => renderRow(r, a))),
  );
}

function renderTasks(v: DayView, all: TaskList, a: Actions): HTMLElement {
  const title = el("input", {
    type: "text",
    id: "task-title",
    placeholder: "What needs a block?",
    autocomplete: "off",
  });
  const est = el("input", {
    type: "number",
    id: "task-est",
    value: "60",
    min: "5",
    step: "5",
    title: "Estimate in minutes",
  });

  const form = el(
    "form",
    {
      class: "task-form",
      onSubmit: (e: Event) => {
        e.preventDefault();
        a.addTask(title.value, Number(est.value) || 60);
        title.value = "";
      },
    },
    title,
    est,
    el("button", { type: "submit", class: "primary" }, "Add"),
  );

  const unplacedIds = new Set(v.unplaced.map((t) => t.id));

  return el(
    "aside",
    { class: "tasks" },
    el(
      "div",
      { class: "tasks-head" },
      el("h2", {}, "Tasks"),
      el(
        "span",
        { class: "muted" },
        `${humanMin(v.usedMin)} of ${humanMin(v.capacityMin)} focus used`,
      ),
    ),
    form,
    all.length === 0
      ? el("p", { class: "empty" }, "No tasks. The anchors alone make a valid day.")
      : el(
          "ul",
          { class: "task-list" },
          all.map((t) =>
            el(
              "li",
              { class: t.status === "done" ? "task done" : "task" },
              el(
                "label",
                { class: "check" },
                el("input", {
                  type: "checkbox",
                  checked: t.status === "done",
                  onChange: () => a.toggleTask(t.id),
                }),
                el("span", {}, t.title),
              ),
              el("span", { class: "muted" }, humanMin(t.estimateMin)),
              unplacedIds.has(t.id) &&
                el(
                  "span",
                  { class: "badge badge-warn" },
                  v.capacityMin === 0 ? "not today" : "no room",
                ),
              el(
                "button",
                { class: "icon danger", title: "Remove", onClick: () => a.removeTask(t.id) },
                "×",
              ),
            ),
          ),
        ),
    v.unplaced.length > 0 &&
      el(
        "p",
        { class: v.capacityMin === 0 ? "banner" : "banner warn" },
        v.capacityMin === 0
          ? "A free day by design — no focus blocks to plan into. These wait for a weekday."
          : `No room today for ${plural(v.unplaced.length, "task")}. Cut, or push to tomorrow.`,
      ),
  );
}

type TaskList = DayView["unplaced"];

/**
 * Rebuild the whole view. The focused field and its caret are restored
 * afterwards so typing a task title survives a re-render.
 */
export function render(root: HTMLElement, v: DayView, all: TaskList, a: Actions): void {
  const active = document.activeElement as HTMLInputElement | null;
  const focusId = active?.id;
  const caret = active?.selectionStart ?? null;
  const value = active?.value;

  root.replaceChildren(
    renderHeader(v, a),
    el("div", { class: "layout" }, renderTimeline(v, a), renderTasks(v, all, a)),
  );

  if (focusId) {
    const next = document.getElementById(focusId) as HTMLInputElement | null;
    if (next) {
      if (value !== undefined && next.value !== value) next.value = value;
      next.focus();
      if (caret !== null && next.type === "text") next.setSelectionRange(caret, caret);
    }
  }
}
