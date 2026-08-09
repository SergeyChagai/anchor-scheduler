/**
 * App entry: wires persisted state to the renderer. Everything is local —
 * no network, no account, works offline once the service worker is installed.
 */
import "./styles.css";
import { fixedOverlaps } from "@anchor-scheduler/core";
import {
  addDays,
  addTask,
  dowOf,
  load,
  nudgeWake,
  removeTask,
  save,
  setTz,
  toISODate,
  toggleCheck,
  toggleTask,
  type AppState,
} from "./state.js";
import { buildDayView } from "./view.js";
import { render, type Actions } from "./ui.js";

const root = document.getElementById("app");
if (!root) throw new Error("#app not found");

let state: AppState = load(localStorage);
/** The day being looked at. Session-only: every launch opens on today. */
let dateISO = toISODate(new Date());

function update(next: AppState): void {
  state = next;
  save(localStorage, state);
  draw();
}

const actions: Actions = {
  shiftDay: (delta) => {
    dateISO = addDays(dateISO, delta);
    draw();
  },
  goToday: () => {
    dateISO = toISODate(new Date());
    draw();
  },
  nudgeWake: (direction) => update(nudgeWake(state, direction)),
  setTz: (tz) => update(setTz(state, tz)),
  toggleCheck: (blockId) => update(toggleCheck(state, dateISO, blockId)),
  addTask: (title, estimateMin) => update(addTask(state, title, estimateMin)),
  toggleTask: (id) => update(toggleTask(state, id)),
  removeTask: (id) => update(removeTask(state, id)),
};

function draw(): void {
  const overlaps = fixedOverlaps(dowOf(dateISO), {
    wakeMin: state.wakeMin,
    tz: state.tz,
  });
  const view = buildDayView(state, dateISO, toISODate(new Date()), overlaps);
  render(root!, view, state.tasks, actions);
}

draw();

// Another tab (or another window of the PWA) edited the same day.
window.addEventListener("storage", () => {
  state = load(localStorage);
  draw();
});

// The Tauri shell serves the bundle from its own protocol and is already
// offline by nature, so the service worker is a browser-only concern.
const inTauri = "__TAURI_INTERNALS__" in window;

if ("serviceWorker" in navigator && import.meta.env.PROD && !inTauri) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline support is a nicety; the app works without it.
    });
  });
}
