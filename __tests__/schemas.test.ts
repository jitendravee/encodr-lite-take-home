import { describe, expect, it } from "vitest";
import { sourceUrlSchema } from "@/lib/schemas";

describe("sourceUrlSchema", () => {
  it("accepts a valid http(s) URL with a path", () => {
    const result = sourceUrlSchema.safeParse("https://cdn.example.com/videos/clip.mp4");
    expect(result.success).toBe(true);
  });

  it("rejects an empty string", () => {
    const result = sourceUrlSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("rejects a non-URL string", () => {
    const result = sourceUrlSchema.safeParse("not a url");
    expect(result.success).toBe(false);
  });

  it("rejects a non-http(s) protocol", () => {
    const result = sourceUrlSchema.safeParse("ftp://cdn.example.com/clip.mp4");
    expect(result.success).toBe(false);
  });

  it("rejects a URL with no path", () => {
    const result = sourceUrlSchema.safeParse("https://cdn.example.com");
    expect(result.success).toBe(false);
  });
});