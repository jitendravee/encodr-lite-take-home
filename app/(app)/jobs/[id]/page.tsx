"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useJob, useStartRun } from "@/lib/client/hooks";
import { useRunPolling } from "@/lib/client/use-run-polling";
import { StatusBadge } from "@/components/status-badge";
import { ProgressBar } from "@/components/progress-bar";

// The header (title, source URL, status badge, loading and not-found states) is provided.
//
// TASK 5 — implemented: Start encode, live progress via useRunPolling, the FAILED case with
// retry, and the COMPLETED results table.
//
// State model: this screen is in exactly one of four phases — idle, running, failed, completed —
// derived from `runId` and `poll.run?.stage`, never from separate booleans. That was the brief's
// explicit ask: `isRunning && isFailed` should be impossible to *express*, not just unlikely.
// A switch over a single `phase` value makes that true by construction — there's no way to be in
// two branches of a switch at once.
export default function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const jobQuery = useJob(id);
  const startRun = useStartRun(id);

  // These two hooks must be called unconditionally, before the loading/error early returns below
  // — otherwise the hook count changes between the "still loading" render and the "loaded" render,
  // which breaks React's rules of hooks (a component's hook calls must be the same every render).
  const [runId, setRunId] = useState<string | null>(null);
  const poll = useRunPolling(runId, () => jobQuery.refetch());

  if (jobQuery.isLoading) {
    return <p className="text-sm text-neutral-500">Loading job…</p>;
  }

  if (jobQuery.isError || !jobQuery.data) {
    return (
      <div className="text-sm text-red-600">
        Job not found.{" "}
        <Link href="/jobs" className="underline">
          Back to jobs
        </Link>
      </div>
    );
  }

  const job = jobQuery.data;

  async function handleStart() {
    const { runId: newRunId } = await startRun.mutateAsync();
    setRunId(newRunId);
  }

  const run = poll.run;
  const phase: "idle" | "running" | "failed" | "completed" =
    !runId || !run
      ? "idle"
      : run.stage === "FAILED"
        ? "failed"
        : run.stage === "COMPLETED"
          ? "completed"
          : "running";

  return (
    <div className="space-y-6">
      <Link href="/jobs" className="text-sm text-neutral-500 hover:underline">
        ← All jobs
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{job.title}</h1>
          <p className="truncate text-sm text-neutral-500">{job.sourceUrl}</p>
        </div>
        <StatusBadge value={job.status} />
      </div>

      <div className="rounded-md border border-neutral-200 p-4">
        {phase === "idle" && (
          <button
            type="button"
            onClick={handleStart}
            disabled={startRun.isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {startRun.isPending ? "Starting…" : "Start encode"}
          </button>
        )}

        {phase !== "idle" && run && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <StatusBadge value={run.stage} />
              <span className="text-sm text-neutral-500">
                {run.progressPct}%
              </span>
            </div>

            <ProgressBar value={run.progressPct} failed={phase === "failed"} />

            {poll.log.length > 0 && (
              <ul className="space-y-1 text-sm text-neutral-600">
                {poll.log.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            )}

            {poll.fetchError && (
              <p className="text-sm text-red-600">
                Couldn’t reach the server: {poll.fetchError}
              </p>
            )}

            {phase === "failed" && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700">{run.error}</p>
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={startRun.isPending}
                  className="mt-2 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Retry
                </button>
              </div>
            )}

            {phase === "completed" && run.result && (
              <div>
                <p className="mb-2 text-sm text-neutral-600">
                  Done in {run.result.durationSec}s.
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-left text-neutral-500">
                      <th className="py-1 pr-4 font-medium">Rendition</th>
                      <th className="py-1 pr-4 font-medium">Resolution</th>
                      <th className="py-1 font-medium">Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.result.renditions.map((r) => (
                      <tr
                        key={r.label}
                        className="border-b border-neutral-100 last:border-0"
                      >
                        <td className="py-1 pr-4">{r.label}</td>
                        <td className="py-1 pr-4">
                          {r.width}×{r.height}
                        </td>
                        <td className="py-1">{r.sizeMb} MB</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
