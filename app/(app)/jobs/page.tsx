"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useJobs, useCreateJob } from "@/lib/client/hooks";
import { createJobSchema, type CreateJobInput } from "@/lib/schemas";
import { ApiError } from "@/lib/client/api";
import { StatusBadge } from "@/components/status-badge";

// The list half of this page is provided and lit up as soon as GET /api/jobs worked (Task 2).
//
// TASK 4 — implemented: the "New encode job" form. Same React Hook Form + zodResolver pattern
// as app/signin/page.tsx, wired to the useCreateJob mutation from lib/client/hooks.ts.
//
// Try https://cdn.example.com/videos/corrupt.mp4 as a source URL — that one is rigged to fail
// partway through its run (Task 5's error path).
export default function JobsPage() {
  const jobs = useJobs();
  const createJob = useCreateJob();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateJobInput>({
    resolver: zodResolver(createJobSchema),
    defaultValues: { sourceUrl: "", title: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createJob.mutateAsync(values);
      reset();
    } catch (e) {
      // A 422 carries per-field messages — put each one on the matching input, the same way
      // the server intended (validationError() on the API side builds this exact shape).
      if (e instanceof ApiError && e.fieldErrors) {
        for (const [field, messages] of Object.entries(e.fieldErrors)) {
          setError(field as keyof CreateJobInput, { message: messages[0] });
        }
      }
      // Anything else (network failure, 401, 500) is left for createJob.error to render below —
      // it isn't a field-level problem, so it doesn't belong on a specific input.
    }
  });

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-xl font-semibold">New encode job</h1>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="sourceUrl"
              className="mb-1 block text-sm font-medium"
            >
              Source URL
            </label>
            <input
              id="sourceUrl"
              {...register("sourceUrl")}
              type="text"
              placeholder="https://cdn.example.com/videos/clip.mp4"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
            {errors.sourceUrl && (
              <p className="mt-1 text-xs text-red-600">
                {errors.sourceUrl.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium">
              Title <span className="text-neutral-400">(optional)</span>
            </label>
            <input
              id="title"
              {...register("title")}
              type="text"
              placeholder="Untitled encode"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
            {errors.title && (
              <p className="mt-1 text-xs text-red-600">
                {errors.title.message}
              </p>
            )}
          </div>

          {createJob.isError &&
            !(
              createJob.error instanceof ApiError && createJob.error.fieldErrors
            ) && (
              <p className="text-sm text-red-600">
                {createJob.error instanceof Error
                  ? createJob.error.message
                  : "Couldn’t create job"}
              </p>
            )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-blue-600 cursor-pointer px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "Creating…" : "Create job"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Jobs</h2>

        {jobs.isLoading && (
          <p className="text-sm text-neutral-500">Loading jobs…</p>
        )}

        {jobs.isError && (
          <div className="text-sm text-red-600">
            Couldn’t load jobs — is GET /api/jobs implemented?{" "}
            <button
              onClick={() => jobs.refetch()}
              className="underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {jobs.data?.length === 0 && (
          <p className="rounded-md border border-neutral-200 p-4 text-sm text-neutral-500">
            No jobs yet. Create one above to get started.
          </p>
        )}

        {jobs.data && jobs.data.length > 0 && (
          <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200">
            {jobs.data.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/10"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{job.title}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {job.sourceUrl}
                    </p>
                  </div>
                  <StatusBadge value={job.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
