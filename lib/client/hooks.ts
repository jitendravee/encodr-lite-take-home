"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import type { CreateJobInput } from "@/lib/schemas";
import type { EncodeRun, Job } from "@/lib/types";

// TanStack Query (React Query) handles server data for us: caching, loading and error flags,
// and refetching. The rule of thumb: useQuery for READING, useMutation for WRITING.
//
// Three worked examples are below. Then two TODOs that follow the same patterns.

/**
 * Query keys are how React Query identifies cached data. Keeping them in one object means you
 * can't typo one half of a pair and wonder why the cache never updates.
 */
export const jobKeys = {
  all: ["jobs"] as const,
  detail: (id: string) => ["jobs", id] as const,
  run: (runId: string) => ["runs", runId] as const,
};

// --- WORKED EXAMPLE 1: reading a list ---
export function useJobs() {
  return useQuery({
    queryKey: jobKeys.all,
    queryFn: ({ signal }) => api.get<Job[]>("/api/jobs", signal),
  });
}

// --- WORKED EXAMPLE 2: reading one item ---
export function useJob(id: string) {
  return useQuery({
    queryKey: jobKeys.detail(id),
    queryFn: ({ signal }) => api.get<Job>(`/api/jobs/${id}`, signal),
  });
}

// --- WORKED EXAMPLE 3: writing, then invalidating the cache ---
//
// After a successful write, the cached data we hold is stale. `invalidateQueries` tells React
// Query "this data is out of date, refetch it" — which is how the UI updates without a reload.
export function useStartRun(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ runId: string }>("/api/runs", { jobId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
      queryClient.invalidateQueries({ queryKey: jobKeys.all });
    },
  });
}

/**
 * TASK 4 — implemented: a mutation that creates a job.
 *
 * POSTs the form values to /api/jobs and, on success, invalidates jobKeys.all so the list
 * refetches and picks up the new job — same pattern as useStartRun above. Errors need no special
 * handling here: api.ts throws an ApiError (with fieldErrors on a 422), and the form reads
 * mutation.error to decide what to show.
 */
export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateJobInput) => api.post<Job>("/api/jobs", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobKeys.all });
    },
  });
}

/**
 * TASK 5 — TODO(candidate): fetch a single run's current state.
 *
 * GET /api/runs/:id returns an EncodeRun. Your polling hook (use-run-polling.ts) needs a way to
 * ask for it. Either a small `fetchRun(runId)` function using `api.get`, or a useQuery hook with
 * a `refetchInterval` — both are legitimate; pick one and say why in the README.
 */

export type { EncodeRun, Job, CreateJobInput };