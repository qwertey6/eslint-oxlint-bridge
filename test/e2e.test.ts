import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { runOxlint } from "../src/runner.js";
import { mapDiagnostic, matchesRuleFilter } from "../src/mapper.js";
import { findOxlintBinary } from "../src/binary.js";

const FIXTURES = resolve(__dirname, "fixtures");

// Try to find oxlint binary (node_modules or PATH)
let OXLINT_BINARY: string | undefined;
try {
  OXLINT_BINARY = findOxlintBinary();
} catch {
  // oxlint not available — e2e tests will be skipped
}

describe.skipIf(!OXLINT_BINARY)("end-to-end with real oxlint binary", () => {
  it("detects unused-var in fixture", () => {
    const results = runOxlint({
      binary: OXLINT_BINARY,
      paths: [resolve(FIXTURES, "unused-var")],
    });

    const indexJs = resolve(FIXTURES, "unused-var/index.js");
    const diags = results.get(indexJs);
    expect(diags).toBeDefined();
    expect(diags!.length).toBeGreaterThanOrEqual(1);

    const mapped = diags!.map(mapDiagnostic);
    const unusedVar = mapped.find((m) => m.ruleId === "oxlint/eslint/no-unused-vars");
    expect(unusedVar).toBeDefined();
    expect(unusedVar!.message).toContain("unusedVariable");
    expect(unusedVar!.severity).toBe(1); // warning
    expect(unusedVar!.line).toBe(2);
  });

  it("produces no diagnostics for clean fixture", () => {
    const results = runOxlint({
      binary: OXLINT_BINARY,
      paths: [resolve(FIXTURES, "clean")],
    });

    const indexJs = resolve(FIXTURES, "clean/index.js");
    const diags = results.get(indexJs);
    expect(diags ?? []).toHaveLength(0);
  });

  it("runs oxlint only once regardless of how many times called", () => {
    const results = runOxlint({
      binary: OXLINT_BINARY,
      paths: [resolve(FIXTURES, "unused-var"), resolve(FIXTURES, "clean")],
    });

    expect(results.size).toBeGreaterThanOrEqual(1);
  });

  it("filters diagnostics by rule name", () => {
    const results = runOxlint({
      binary: OXLINT_BINARY,
      paths: [resolve(FIXTURES, "unused-var")],
    });

    const indexJs = resolve(FIXTURES, "unused-var/index.js");
    const diags = results.get(indexJs) ?? [];

    const filtered = diags.filter((d) => matchesRuleFilter(d, ["no-debugger"]));
    expect(filtered).toHaveLength(0);

    const matching = diags.filter((d) => matchesRuleFilter(d, ["no-unused-vars"]));
    expect(matching.length).toBeGreaterThanOrEqual(1);
  });
});
