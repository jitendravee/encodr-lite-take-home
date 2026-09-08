import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRunPolling } from "@/lib/client/use-run-polling";

// This is the thing the brief cares about most, so it gets its own proof rather than just
// trusting the implementation: mock the network call, advance fake timers, and assert the call
// count stops growing — once after unmount, once after the run finishes.

vi.mock("@/lib/client/api", () => ({
  api: { get: vi.fn() },
}));

import { api } from "@/lib/client/api";

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useRunPolling — cleanup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(api.get).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops issuing requests after the component unmounts", async () => {
    vi.mocked(api.get).mockResolvedValue({
      id: "r1",
      jobId: "j1",
      stage: "DOWNLOADING",
      progressPct: 20,
      message: "Downloading source file…",
    });

    const { unmount } = renderHook(() => useRunPolling("r1"));
    await tick(0); // let the immediate poll() resolve

    const callsBeforeUnmount = vi.mocked(api.get).mock.calls.length;
    expect(callsBeforeUnmount).toBeGreaterThan(0);

    unmount();
    await tick(5_000); // several 1s ticks worth of "would have polled"

    expect(vi.mocked(api.get).mock.calls.length).toBe(callsBeforeUnmount);
  });

  it("stops issuing requests once the run reaches a terminal stage", async () => {
    vi.mocked(api.get).mockResolvedValue({
      id: "r1",
      jobId: "j1",
      stage: "COMPLETED",
      progressPct: 100,
      message: "Encode complete.",
      result: { durationSec: 184, renditions: [] },
    });

    renderHook(() => useRunPolling("r1"));
    await tick(0);

    const callsAfterFirstPoll = vi.mocked(api.get).mock.calls.length;
    await tick(5_000);

    expect(vi.mocked(api.get).mock.calls.length).toBe(callsAfterFirstPoll);
  });

  it("does nothing at all when runId is null", async () => {
    renderHook(() => useRunPolling(null));
    await tick(5_000);

    expect(api.get).not.toHaveBeenCalled();
  });
});