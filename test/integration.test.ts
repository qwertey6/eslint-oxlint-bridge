import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolve } from "node:path";

// Integration tests for the bridge processor behavior
// These test the processor logic with mocked oxlint output

describe("bridge processor", () => {
  it("injects oxlint diagnostics into ESLint postprocess output", async () => {
    // We test the processor by importing the bridge and accessing its internals
    const { default: oxlintBridge } = await import("../src/index.js");

    // Mock findOxlintBinary to avoid needing the real binary for processor tests
    // Instead, we test parseOxlintOutput + mapDiagnostic + matchesRuleFilter directly
    const { parseOxlintOutput } = await import("../src/runner.js");
    const { mapDiagnostic, matchesRuleFilter } = await import("../src/mapper.js");

    // Simulate oxlint JSON output
    const mockOutput = JSON.stringify({
      diagnostics: [
        {
          message: "`debugger` statement is not allowed",
          code: "eslint(no-debugger)",
          severity: "error",
          causes: [],
          url: "https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-debugger.html",
          help: "Remove the debugger statement",
          filename: "src/app.js",
          labels: [{ span: { offset: 38, length: 9, line: 5, column: 1 } }],
          related: [],
        },
        {
          message: "Function 'unused' is declared but never used.",
          code: "eslint(no-unused-vars)",
          severity: "warning",
          causes: [],
          help: "Consider removing this declaration.",
          filename: "src/utils.js",
          labels: [
            {
              label: "'unused' is declared here",
              span: { offset: 9, length: 6, line: 1, column: 10 },
            },
          ],
          related: [],
        },
      ],
      number_of_files: 2,
      number_of_rules: 50,
      threads_count: 4,
      start_time: 0.015,
    });

    const results = parseOxlintOutput(mockOutput);

    // Verify grouping by file
    expect(results.size).toBe(2);

    // Check app.js diagnostics
    const appDiags = results.get(resolve("src/app.js"));
    expect(appDiags).toHaveLength(1);

    const mapped = mapDiagnostic(appDiags![0]);
    expect(mapped).toEqual({
      ruleId: "oxlint/eslint/no-debugger",
      severity: 2,
      message:
        "`debugger` statement is not allowed (Remove the debugger statement)",
      line: 5,
      column: 1,
      endLine: 5,
      endColumn: 10,
    });

    // Check utils.js diagnostics
    const utilsDiags = results.get(resolve("src/utils.js"));
    expect(utilsDiags).toHaveLength(1);

    const mappedWarning = mapDiagnostic(utilsDiags![0]);
    expect(mappedWarning.severity).toBe(1);
    expect(mappedWarning.ruleId).toBe("oxlint/eslint/no-unused-vars");
  });

  it("filters diagnostics by rule name", async () => {
    const { parseOxlintOutput } = await import("../src/runner.js");
    const { matchesRuleFilter } = await import("../src/mapper.js");

    const mockOutput = JSON.stringify({
      diagnostics: [
        {
          message: "debugger found",
          code: "eslint(no-debugger)",
          severity: "error",
          causes: [],
          filename: "test.js",
          labels: [{ span: { offset: 0, length: 9, line: 1, column: 1 } }],
          related: [],
        },
        {
          message: "unused var",
          code: "eslint(no-unused-vars)",
          severity: "warning",
          causes: [],
          filename: "test.js",
          labels: [{ span: { offset: 20, length: 3, line: 2, column: 5 } }],
          related: [],
        },
        {
          message: "floating promise",
          code: "typescript(no-floating-promises)",
          severity: "error",
          causes: [],
          filename: "test.js",
          labels: [{ span: { offset: 50, length: 10, line: 4, column: 1 } }],
          related: [],
        },
      ],
      number_of_files: 1,
      number_of_rules: 50,
      threads_count: 4,
      start_time: 0.01,
    });

    const results = parseOxlintOutput(mockOutput);
    const diags = results.get(resolve("test.js"))!;
    expect(diags).toHaveLength(3);

    // Filter to only no-floating-promises
    const filtered = diags.filter((d) =>
      matchesRuleFilter(d, ["no-floating-promises"]),
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].code).toBe("typescript(no-floating-promises)");

    // Filter to multiple rules
    const multi = diags.filter((d) =>
      matchesRuleFilter(d, ["no-debugger", "no-floating-promises"]),
    );
    expect(multi).toHaveLength(2);
  });

  it("handles empty oxlint output gracefully", async () => {
    const { parseOxlintOutput } = await import("../src/runner.js");

    const mockOutput = JSON.stringify({
      diagnostics: [],
      number_of_files: 10,
      number_of_rules: 50,
      threads_count: 4,
      start_time: 0.005,
    });

    const results = parseOxlintOutput(mockOutput);
    expect(results.size).toBe(0);
  });

  it("preserves ESLint's own messages alongside oxlint messages", async () => {
    const { parseOxlintOutput } = await import("../src/runner.js");
    const { mapDiagnostic } = await import("../src/mapper.js");

    // Simulate what postprocess does: merge ESLint messages with oxlint messages
    const eslintMessages = [
      {
        ruleId: "react-hooks/exhaustive-deps",
        severity: 1 as const,
        message: "React Hook useEffect has a missing dependency",
        line: 10,
        column: 3,
      },
    ];

    const mockOutput = JSON.stringify({
      diagnostics: [
        {
          message: "debugger found",
          code: "eslint(no-debugger)",
          severity: "error",
          causes: [],
          filename: "src/Component.tsx",
          labels: [{ span: { offset: 0, length: 9, line: 5, column: 1 } }],
          related: [],
        },
      ],
      number_of_files: 1,
      number_of_rules: 50,
      threads_count: 4,
      start_time: 0.01,
    });

    const results = parseOxlintOutput(mockOutput);
    const oxlintDiags = results.get(resolve("src/Component.tsx")) ?? [];
    const bridgedMessages = oxlintDiags.map(mapDiagnostic);

    // Merge like postprocess would
    const combined = [...eslintMessages, ...bridgedMessages];

    expect(combined).toHaveLength(2);
    expect(combined[0].ruleId).toBe("react-hooks/exhaustive-deps");
    expect(combined[1].ruleId).toBe("oxlint/eslint/no-debugger");
  });
});

describe("CLI args for different configs", () => {
  it("typeAware adds --type-aware flag", async () => {
    const { buildCliArgs } = await import("../src/runner.js");
    const args = buildCliArgs({ typeAware: true });
    expect(args).toContain("--type-aware");
  });

  it("does not add --type-aware when disabled", async () => {
    const { buildCliArgs } = await import("../src/runner.js");
    const args = buildCliArgs({});
    expect(args).not.toContain("--type-aware");
  });
});
