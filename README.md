# Encodr Lite — Intern Take-Home

Thanks for taking the time on this. **Encodr Lite** is a small media-transcoding dashboard: a
signed-in user creates an encode **job** from a media URL, presses **Start encode**, watches the
progress update live, and sees the output files when it finishes.

The full brief — the six tasks, what we look for, and the ground rules — is in **`BRIEF.md`**.
**Read that first.** This file is just how to run things, and it's where you write up your work when
you're done.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm run test:run     # tests — 20 across 4 files
npm run typecheck    # tsc --noEmit
npm run build        # production build
```

Requires **Node 20+** (`.nvmrc` says 20).

**Demo login:** `demo@encodr.dev` / `password123`

On a fresh checkout, sign-in works and the app loads, but the jobs list shows an error and the two
main screens are placeholders. That's expected — `GET /api/jobs` returns a 501 until you write it.
Search the project for `TODO(candidate)` to find everything that's yours; there are six.

Nothing here needs a database. State lives in memory, so restarting the dev server wipes your jobs.
That's fine — don't work around it.

## Where things are

```
app/
  signin/page.tsx              working sign-in — your example of RHF + Zod
  (app)/layout.tsx             route guard for everything signed-in
  (app)/jobs/page.tsx          TASK 4 — the create-job form
  (app)/jobs/[id]/page.tsx     TASK 5 — run controls, progress, results
  api/auth/login/route.ts      provided
  api/jobs/route.ts            TASK 2 — list + create
  api/jobs/[id]/route.ts       provided — your example route handler
  api/runs/route.ts            provided — starts a run
  api/runs/[id]/route.ts       provided — the endpoint you'll poll
lib/
  types.ts                     the data model + the run TIMELINE. Read this first.
  schemas.ts                   TASK 1 — source-URL validation
  server/auth.ts               provided — token signing
  server/http.ts               provided — json / error / withAuth / validationError
  server/store.ts              TASK 3 — computeRun()
  client/api.ts                provided — the fetch wrapper
  client/auth-context.tsx      provided
  client/hooks.ts              worked React Query examples + two TODOs
  client/use-run-polling.ts    TASK 5 — the polling hook
components/                    provided — StatusBadge, ProgressBar
__tests__/                     TASK 6 — your tests go here
```

## A suggested first hour

If you're not sure where to start:

1. `npm install && npm run dev`, sign in, look around. The jobs list will show an error — good, that's
   your first task.
2. Read `lib/types.ts` top to bottom. It's short and it's the whole data model.
3. Read `app/api/jobs/[id]/route.ts` — a complete route handler — then write Task 2 in the same style
   and check it with the curl commands in the file.
4. The list page lights up. Now do Task 1, then Task 3 (tests first).

## Useful to know

- `https://cdn.example.com/videos/corrupt.mp4` is rigged to **fail** partway through its run. Use it
  to build the error path.
- A run takes about **12 seconds** from start to finish, so you won't be waiting around.
- Run timings are constants in `TIMELINE` (`lib/types.ts`). Use them instead of typing numbers, so
  your tests and ours agree.
- `computeRun` takes `now` as an argument on purpose — you can test the 8-second mark without
  waiting eight seconds.

---

# Write-up

### What's working

All six tasks are done:

1. **Source-URL validation** (`lib/schemas.ts`) — `sourceUrlSchema` accepts `http(s)` URLs with a
   file path, rejects everything else with a message per failure mode. Built with `.superRefine`,
   not chained `.refine()` — chaining re-runs every later check even after an earlier one fails,
   which threw on non-URL strings. `.superRefine` with an early `return` after `ctx.addIssue`
   short-circuits properly.
2. **Jobs API** (`app/api/jobs/route.ts`) — `GET`/`POST`, both behind `withAuth`. `POST` validates
   with the same `createJobSchema` the form uses, 400 on unparsable JSON, 422 with `fieldErrors` on
   invalid input, 201 + the created job on success.
3. **`computeRun`** (`lib/server/store.ts`) — pure function of elapsed time. Branches ordered
   latest-boundary-first with `>=` comparisons so a boundary value lands in the *later* stage, per
   the brief's own `2000ms <= elapsed < 6000ms -> DOWNLOADING` spec. The corrupt-source check runs
   first but is gated on `elapsed >= failAtMs`, so it behaves like a normal run right up to that
   point. Progress on a FAILED run is frozen at `percentAt(failAtMs)`, not `percentAt(elapsed)`, so
   it stops climbing the instant it fails.
4. **Create-job form** (`app/(app)/jobs/page.tsx`, `lib/client/hooks.ts`) — RHF + `zodResolver`,
   same pattern as the sign-in page. A 422's `fieldErrors` are mapped onto the matching input via
   `setError`; other errors (network, 5xx) render as a banner instead, gated so it doesn't duplicate
   an inline message.
5. **Live polling + detail page** (`lib/client/use-run-polling.ts`,
   `app/(app)/jobs/[id]/page.tsx`) — see "decisions" below for the state model and the cleanup bug
   I hit and fixed.
6. **Tests** — 20 across 4 files: 10 `computeRun` boundary/corrupt-source tests, 5 `sourceUrlSchema`
   tests, 3 polling-cleanup tests (mocked `api.get` + fake timers), 2 component tests on the
   create-job form (invalid URL never calls the API; valid URL calls it with the right payload).
   `example.test.ts` deleted once real tests existed, per its own comment.

Nothing is knowingly broken or half-finished. I did not attempt any of the "if you have time left
over" optional items (visibility-based pause, smoothed progress bar, relative timestamps,
accessibility pass) — the six required tasks and a real regression-catching test suite felt like
the better use of the time budget.

### How to see the failure path

Create a job with source URL `https://cdn.example.com/videos/corrupt.mp4` (any title). Press
**Start encode** on its detail page. It behaves like a normal run — QUEUED, then DOWNLOADING — until
around the 8-second mark, where it flips to **FAILED**: a red progress bar, a red error panel with
the message, and a **Retry** button that starts a fresh run.

You can also see it without the UI:

```bash
TOKEN=$(curl -s localhost:3000/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"demo@encodr.dev","password":"password123"}' | sed 's/.*"token":"\([^"]*\)".*/\1/')
JOB_ID=$(curl -s localhost:3000/api/jobs -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"sourceUrl":"https://cdn.example.com/videos/corrupt.mp4"}' \
  | sed 's/.*"id":"\([^"]*\)".*/\1/')
RUN_ID=$(curl -s localhost:3000/api/runs -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d "{\"jobId\":\"$JOB_ID\"}" | sed 's/.*"runId":"\([^"]*\)".*/\1/')
sleep 9 && curl -s localhost:3000/api/runs/$RUN_ID -H "authorization: Bearer $TOKEN"
# -> {"stage":"FAILED","progressPct":67,"error":"The source file appears to be corrupt..."}
```

### Decisions and assumptions

- **Detail-page state model:** the screen is in exactly one of `"idle" | "running" | "failed" |
  "completed"`, derived in one place from `runId` and `run.stage` — not tracked as several separate
  booleans. A `switch`-shaped derivation means `isRunning && isFailed` isn't just unlikely, it's
  impossible to write.
- **Polling cleanup, two separate mechanisms:** a `cancelled` closure flag guards against writing
  state from a request that resolves after unmount/`runId`-change, and `clearInterval` stops future
  ticks. The one I got wrong on my first pass: I set `polling: false` on a terminal stage but never
  called `clearInterval` — the timer kept firing every second forever, just silently discarding the
  response. My own cleanup test caught it (asserted the mock call count immediately, expected it not
  to grow — it did). Fixed by calling `clearInterval` from inside `poll()` itself the moment
  `isTerminalStage(run.stage)` is true, not relying only on the effect's own cleanup function, which
  only runs on unmount or a `runId` change — it has no way to know the run finished on its own.
- **`useState`/`useRunPolling` are called before the loading/error early returns** on the detail
  page. Calling them after would change the hook count between the "job still loading" render and
  the "job loaded" render, which breaks React's rules of hooks.
- **A request body that isn't valid JSON gets a 400** before it ever reaches `createJobSchema`. The
  brief's bullet list doesn't mention this case explicitly, but "the server doesn't trust the
  client" implies it — a malformed body shouldn't reach Zod at all.
- **`sourceUrlSchema` rejects `ftp://...` and a plain non-URL string** with different messages
  (structurally invalid vs. wrong protocol), even though both ultimately fail — felt more useful to
  a user typing the wrong thing than one generic message for both.

### What was hardest

The polling cleanup — specifically, that there are *two different* things that need to stop the
interval, not one. I initially treated "the run finished" and "the component went away" as the same
problem and only handled the second one properly (`clearInterval` in the effect's return function).
The first pass looked correct by inspection: `polling` flipped to `false` in state, the UI stopped
showing a spinner, nothing looked broken in the browser. It was only wrong underneath — the
`setInterval` kept ticking and hitting `/api/runs/:id` once a second forever, just silently ignoring
the (already-terminal) response. Writing the fake-timer test before trusting the implementation is
what caught it: I asserted the request count immediately after the run went to `COMPLETED`, advanced
five more seconds of fake time, and the count kept climbing. That made the bug undeniable in a way
"looks fine in the browser" didn't. Fixed by calling `clearInterval` from inside `poll()` the moment
the stage is terminal, not just from the effect's cleanup function.

### What I'd do next

With another day: pause polling when `document.visibilityState` is hidden (per the brief's optional
list), smooth the progress bar between polls with a client-side interpolation rather than jumping on
each response, add the relative "created N minutes ago" timestamp to the job list, and do a proper
accessibility pass on the create-job form (I have labels tied to inputs and errors rendered near
their field, but haven't verified focus management or `aria-live` on the error region).

### Time spent

<!-- Replace with your own honest number — I don't know how long this actually took you. Roughly
     is fine; there's no wrong answer, it just helps them calibrate the exercise. -->