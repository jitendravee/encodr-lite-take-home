import { describe, expect, it } from "vitest";
import { computeRun, FAIL_URL, type RunRecord } from "@/lib/server/store";
import { TIMELINE } from "@/lib/types";

// Written BEFORE computeRun() is implemented, per the brief. Each test fixes `startedAt` at 0
// so `now` is just the elapsed time in ms — makes the boundary numbers easy to read and reason about.

function record(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: "r_test",
    jobId: "j_test",
    sourceUrl: "https://cdn.example.com/videos/clip.mp4",
    startedAt: 0,
    ...overrides,
  };
}

describe("computeRun — happy path stage boundaries", () => {
  it("is QUEUED at elapsed 0", () => {
    const run = computeRun(record(), 0);
    expect(run.stage).toBe("QUEUED");
    expect(run.progressPct).toBe(0);
  });

  it("is still QUEUED just before the DOWNLOADING boundary", () => {
    const run = computeRun(record(), TIMELINE.queuedEndsMs - 1);
    expect(run.stage).toBe("QUEUED");
  });

  it("moves to DOWNLOADING exactly at the boundary", () => {
    const run = computeRun(record(), TIMELINE.queuedEndsMs);
    expect(run.stage).toBe("DOWNLOADING");
  });

  it("moves to TRANSCODING exactly at the boundary", () => {
    const run = computeRun(record(), TIMELINE.downloadingEndsMs);
    expect(run.stage).toBe("TRANSCODING");
  });

  it("completes exactly at the boundary, with a result and no error", () => {
    const run = computeRun(record(), TIMELINE.transcodingEndsMs);
    expect(run.stage).toBe("COMPLETED");
    expect(run.progressPct).toBe(100);
    expect(run.result).toBeDefined();
    expect(run.error).toBeUndefined();
  });

  it("stays COMPLETED well after the timeline ends", () => {
    const run = computeRun(record(), TIMELINE.transcodingEndsMs + 60_000);
    expect(run.stage).toBe("COMPLETED");
    expect(run.progressPct).toBe(100);
  });
});

describe("computeRun — the corrupt source", () => {
  it("behaves like a normal run right up until the fail point", () => {
    const run = computeRun(record({ sourceUrl: FAIL_URL }), TIMELINE.failAtMs - 1);
    expect(run.stage).toBe("TRANSCODING");
  });

  it("fails exactly at the fail point, with an error and no result", () => {
    const run = computeRun(record({ sourceUrl: FAIL_URL }), TIMELINE.failAtMs);
    expect(run.stage).toBe("FAILED");
    expect(run.error).toBeDefined();
    expect(run.result).toBeUndefined();
  });

  it("stays FAILED afterwards and never reaches COMPLETED", () => {
    const run = computeRun(record({ sourceUrl: FAIL_URL }), TIMELINE.transcodingEndsMs + 60_000);
    expect(run.stage).toBe("FAILED");
  });

  it("freezes progress at the point of failure instead of continuing to climb", () => {
    const atFail = computeRun(record({ sourceUrl: FAIL_URL }), TIMELINE.failAtMs);
    const wellAfter = computeRun(record({ sourceUrl: FAIL_URL }), TIMELINE.failAtMs + 60_000);
    expect(wellAfter.progressPct).toBe(atFail.progressPct);
  });
});