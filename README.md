# anchor-scheduler

Local-first, cross-platform day scheduler built on **fixed anchors** + **time-blocked tasks**.

The idea: a day is held together by a few non-negotiable anchors (a steady wake
time, walks, bedtime). Everything else hangs off them. Instead of a rigid
minute-by-minute plan that a procrastinator abandons in two days, you keep the
anchors and let the flexible blocks absorb the rest. TODO tasks are time-blocked
into the "focus" containers automatically.

## Why a shared core

Everything except smartwatches can share one TypeScript engine. Watches are a
thin native glance surface (SwiftUI / Wear OS tile), not part of this codebase.

```
packages/core   framework-agnostic engine (schedule + task blocking) — tested
apps/web        local-first web/PWA surface over the engine — tested
```

Planned surfaces (not built yet): desktop/mobile via Tauri 2 wrapping the web
UI; sync via Cloudflare (D1 / Durable Objects) once a second device exists.

## The model

A **block** is pinned either to the wake time (`off`, slides as wake shifts) or
to the wall clock (`abs`, fixed — dinner, the Armenian lesson, the Monday call).
The engine resolves a day for a given wake time and timezone:

- **Wake-shift plan.** `START_WAKE` (12:00) → `GOAL_WAKE` (09:30) in 20-minute
  steps. The whole day is authored as offsets from wake, so moving wake earlier
  slides everything with it; only fixed commitments stay put. `wakePhases()` is
  the ladder of rungs; the span isn't a whole number of steps, so the last move
  is a short one that lands exactly on the goal.
- **Timezone calibration.** Schedule is authored in Armenia (UTC+4). Selecting
  Thailand (UTC+7) shifts every displayed clock by +3h, preserving the body
  clock while travelling.
- **Anchors define "done".** A day counts as complete when its anchors are
  checked — not when every block is perfect.
- **Work accounting + overlap safety** are computed, not guessed
  (`workHours`, `fixedOverlaps`).

## Task time-blocking

`flexWindows` exposes the focus containers (deep blocks + main work) as
schedulable windows; `planTasks` first-fits TODO tasks into them and returns
both the `blockId` each task landed in and anything that doesn't fit as
`unplaced` ("no room today"). A late wake genuinely shrinks the day: at 12:00 a
Monday offers 1h45m of focus, at 09:30 it offers 5h45m.

## The web surface

`apps/web` is the real UI: a day timeline with anchor checkboxes, the wake
stepper, the Armenia/Thailand toggle, and a task list whose items appear inside
the focus block they were time-blocked into.

Local-first in the literal sense — state lives in `localStorage`, nothing
leaves the device, and a service worker keeps it working offline. Anchor checks
are stored per calendar day, so yesterday's day stays as you left it.

```bash
pnpm install
pnpm --filter @anchor-scheduler/web dev     # http://localhost:5173
```

## Quick start

```bash
pnpm install
pnpm -r test        # 36 tests across core + web
pnpm -r typecheck
pnpm -r build
```

Or just the core package:

```bash
cd packages/core
pnpm test
```

## Status

The engine and the web surface are both real and tested (36 tests). Desktop and
mobile wrappers, and sync, are still ahead. No CI yet.

## License

MIT © 2026 Sergey Chagai
