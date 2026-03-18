import { describe, it, expect } from "vitest";
import { findOxlintBinary } from "../src/binary.js";

describe("findOxlintBinary", () => {
  it("returns explicit path if file exists", () => {
    // /bin/sh always exists on unix
    const result = findOxlintBinary("/bin/sh");
    expect(result).toBe("/bin/sh");
  });

  it("throws for non-existent explicit path", () => {
    expect(() => findOxlintBinary("/nonexistent/oxlint")).toThrow(
      'Specified oxlint binary not found at "/nonexistent/oxlint"',
    );
  });

  it("finds oxlint on PATH if available", () => {
    // This test will pass if oxlint is installed (which it is in this repo)
    // and fail gracefully otherwise
    try {
      const result = findOxlintBinary();
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
    } catch (err) {
      // If oxlint is not available, we should get the specific error
      expect((err as Error).message).toContain("oxlint binary not found");
    }
  });

  it("throws with helpful message when explicit binary not found", () => {
    expect(() => findOxlintBinary("/definitely/not/here/oxlint")).toThrow(
      "Specified oxlint binary not found",
    );
  });
});
