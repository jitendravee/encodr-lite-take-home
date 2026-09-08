import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import JobsPage from "@/app/(app)/jobs/page";

// Mocks the API boundary, not the form — this is a real React Hook Form + zodResolver validating
// against the real createJobSchema. Only the network call is faked, and ApiError is kept real
// (via importOriginal) so `e instanceof ApiError` checks elsewhere in the app still work.
vi.mock("@/lib/client/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client/api")>();
  return {
    ...actual,
    api: { get: vi.fn(), post: vi.fn() },
  };
});

import { api } from "@/lib/client/api";

function renderWithQueryClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <JobsPage />
    </QueryClientProvider>,
  );
}

describe("JobsPage — create-job form validation", () => {
  it("shows an inline error and never calls the API for an invalid source URL", async () => {
    vi.mocked(api.get).mockResolvedValue([]); // the job list query, so the page has something to render
    const user = userEvent.setup();

    renderWithQueryClient();

    const sourceUrlInput = await screen.findByLabelText(/source url/i);
    await user.type(sourceUrlInput, "not a url");
    await user.click(screen.getByRole("button", { name: /create job/i }));

    expect(await screen.findByText(/enter a valid url/i)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("submits a valid URL and calls the API", async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    vi.mocked(api.post).mockResolvedValue({
      id: "j_1",
      title: "clip.mp4",
      sourceUrl: "https://cdn.example.com/videos/clip.mp4",
      status: "NEW",
      createdAt: new Date().toISOString(),
    });
    const user = userEvent.setup();

    renderWithQueryClient();

    const sourceUrlInput = await screen.findByLabelText(/source url/i);
    await user.type(sourceUrlInput, "https://cdn.example.com/videos/clip.mp4");
    await user.click(screen.getByRole("button", { name: /create job/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledWith(
      "/api/jobs",
      expect.objectContaining({
        sourceUrl: "https://cdn.example.com/videos/clip.mp4",
      }),
    );
  });
});
