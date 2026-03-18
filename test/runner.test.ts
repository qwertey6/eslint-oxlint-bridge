import { describe, it, expect } from "vitest";
import { buildCliArgs, parseOxlintOutput } from "../src/runner.js";
import type { BridgeOptions } from "../src/types.js";

describe("buildCliArgs", () => {
  it("produces basic args with defaults", () => {
    const args = buildCliArgs({});
    expect(args).toEqual(["--format", "json", "."]);
  });

  it("adds --type-aware when enabled", () => {
    const args = buildCliArgs({ typeAware: true });
    expect(args).toEqual(["--format", "json", "--type-aware", "."]);
  });

  it("uses custom paths", () => {
    const args = buildCliArgs({ paths: ["src/", "lib/"] });
    expect(args).toEqual(["--format", "json", "src/", "lib/"]);
  });

  it("passes extra args", () => {
    const args = buildCliArgs({ extraArgs: ["-D", "no-debugger"] });
    expect(args).toEqual(["--format", "json", "-D", "no-debugger", "."]);
  });

  it("combines all options", () => {
    const opts: BridgeOptions = {
      typeAware: true,
      paths: ["src/"],
      extraArgs: ["--threads", "4"],
    };
    const args = buildCliArgs(opts);
    expect(args).toEqual([
      "--format", "json",
      "--type-aware",
      "--threads", "4",
      "src/",
    ]);
  });
});

describe("parseOxlintOutput", () => {
  it("parses valid JSON with diagnostics", () => {
    const json = JSON.stringify({
      diagnostics: [
        {
          message: "test error",
          code: "eslint(no-debugger)",
          severity: "error",
          causes: [],
          filename: "src/test.js",
          labels: [{ span: { offset: 0, length: 9, line: 1, column: 1 } }],
          related: [],
        },
        {
          message: "another error",
          code: "eslint(no-debugger)",
          severity: "error",
          causes: [],
          filename: "src/test.js",
          labels: [{ span: { offset: 20, length: 9, line: 3, column: 1 } }],
          related: [],
        },
        {
          message: "different file",
          code: "eslint(no-unused-vars)",
          severity: "warning",
          causes: [],
          filename: "src/other.js",
          labels: [{ span: { offset: 0, length: 3, line: 1, column: 1 } }],
          related: [],
        },
      ],
      number_of_files: 2,
      number_of_rules: 10,
      threads_count: 4,
      start_time: 0.001,
    });

    const results = parseOxlintOutput(json);

    // Should group by resolved file path
    expect(results.size).toBe(2);

    const testJsDiags = results.get(process.cwd() + "/src/test.js");
    expect(testJsDiags).toHaveLength(2);

    const otherJsDiags = results.get(process.cwd() + "/src/other.js");
    expect(otherJsDiags).toHaveLength(1);
  });

  it("returns empty map for empty output", () => {
    const results = parseOxlintOutput("");
    expect(results.size).toBe(0);
  });

  it("returns empty map for no diagnostics", () => {
    const json = JSON.stringify({
      diagnostics: [],
      number_of_files: 5,
      number_of_rules: 10,
      threads_count: 4,
      start_time: 0.001,
    });

    const results = parseOxlintOutput(json);
    expect(results.size).toBe(0);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseOxlintOutput("not json at all")).toThrow(
      "Failed to parse oxlint JSON output",
    );
  });

  it("handles output without diagnostics array", () => {
    const json = JSON.stringify({ some: "other format" });
    const results = parseOxlintOutput(json);
    expect(results.size).toBe(0);
  });
});
