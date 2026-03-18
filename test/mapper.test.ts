import { describe, it, expect } from "vitest";
import {
  parseRuleId,
  mapSeverity,
  buildMessage,
  mapDiagnostic,
  matchesRuleFilter,
} from "../src/mapper.js";
import type { OxlintDiagnostic } from "../src/types.js";

describe("parseRuleId", () => {
  it("parses eslint rule code", () => {
    expect(parseRuleId("eslint(no-debugger)")).toBe("oxlint/eslint/no-debugger");
  });

  it("parses typescript rule code", () => {
    expect(parseRuleId("typescript(no-floating-promises)")).toBe(
      "oxlint/typescript/no-floating-promises",
    );
  });

  it("parses react rule code", () => {
    expect(parseRuleId("react(no-direct-mutation-state)")).toBe(
      "oxlint/react/no-direct-mutation-state",
    );
  });

  it("parses unicorn rule code", () => {
    expect(parseRuleId("unicorn(no-null)")).toBe("oxlint/unicorn/no-null");
  });

  it("returns null for undefined code", () => {
    expect(parseRuleId(undefined)).toBeNull();
  });

  it("handles code without parentheses as fallback", () => {
    expect(parseRuleId("some-unknown-format")).toBe("oxlint/some-unknown-format");
  });
});

describe("mapSeverity", () => {
  it('maps "error" to 2', () => {
    expect(mapSeverity("error")).toBe(2);
  });

  it('maps "warning" to 1', () => {
    expect(mapSeverity("warning")).toBe(1);
  });

  it('maps "advice" to 1', () => {
    expect(mapSeverity("advice")).toBe(1);
  });
});

describe("buildMessage", () => {
  it("returns message alone when no help", () => {
    const diag = { message: "Something is wrong" } as OxlintDiagnostic;
    expect(buildMessage(diag)).toBe("Something is wrong");
  });

  it("appends help text in parentheses", () => {
    const diag = {
      message: "`debugger` statement is not allowed",
      help: "Remove the debugger statement",
    } as OxlintDiagnostic;
    expect(buildMessage(diag)).toBe(
      "`debugger` statement is not allowed (Remove the debugger statement)",
    );
  });
});

describe("mapDiagnostic", () => {
  it("maps a complete diagnostic", () => {
    const diag: OxlintDiagnostic = {
      message: "`debugger` statement is not allowed",
      code: "eslint(no-debugger)",
      severity: "error",
      causes: [],
      url: "https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-debugger.html",
      help: "Remove the debugger statement",
      filename: "test.js",
      labels: [
        {
          span: { offset: 38, length: 9, line: 5, column: 1 },
        },
      ],
      related: [],
    };

    const result = mapDiagnostic(diag);
    expect(result).toEqual({
      ruleId: "oxlint/eslint/no-debugger",
      severity: 2,
      message: "`debugger` statement is not allowed (Remove the debugger statement)",
      line: 5,
      column: 1,
      endLine: 5,
      endColumn: 10, // 1 + 9
    });
  });

  it("maps a warning diagnostic", () => {
    const diag: OxlintDiagnostic = {
      message: "Function 'foo' is declared but never used.",
      code: "eslint(no-unused-vars)",
      severity: "warning",
      causes: [],
      help: "Consider removing this declaration.",
      filename: "test.js",
      labels: [
        {
          label: "'foo' is declared here",
          span: { offset: 9, length: 3, line: 1, column: 10 },
        },
      ],
      related: [],
    };

    const result = mapDiagnostic(diag);
    expect(result.ruleId).toBe("oxlint/eslint/no-unused-vars");
    expect(result.severity).toBe(1);
    expect(result.line).toBe(1);
    expect(result.column).toBe(10);
    expect(result.endColumn).toBe(13); // 10 + 3
  });

  it("handles diagnostic without labels", () => {
    const diag: OxlintDiagnostic = {
      message: "Something happened",
      severity: "error",
      causes: [],
      filename: "test.js",
      labels: [],
      related: [],
    };

    const result = mapDiagnostic(diag);
    expect(result.line).toBe(1);
    expect(result.column).toBe(1);
    expect(result.endLine).toBeUndefined();
    expect(result.endColumn).toBeUndefined();
  });

  it("handles diagnostic without code (parser error)", () => {
    const diag: OxlintDiagnostic = {
      message: 'Expected `;` but found `:`',
      severity: "error",
      causes: [],
      filename: "test.js",
      labels: [
        {
          label: "`;` expected",
          span: { offset: 53, length: 1, line: 3, column: 9 },
        },
      ],
      related: [],
    };

    const result = mapDiagnostic(diag);
    expect(result.ruleId).toBeNull();
  });

  it("handles zero-length span (no endLine/endColumn)", () => {
    const diag: OxlintDiagnostic = {
      message: "Missing semicolon",
      code: "eslint(semi)",
      severity: "warning",
      causes: [],
      filename: "test.js",
      labels: [
        {
          span: { offset: 10, length: 0, line: 1, column: 11 },
        },
      ],
      related: [],
    };

    const result = mapDiagnostic(diag);
    expect(result.endLine).toBeUndefined();
    expect(result.endColumn).toBeUndefined();
  });
});

describe("matchesRuleFilter", () => {
  const diag: OxlintDiagnostic = {
    message: "test",
    code: "typescript(no-floating-promises)",
    severity: "error",
    causes: [],
    filename: "test.ts",
    labels: [],
    related: [],
  };

  it('passes everything when rules is "all"', () => {
    expect(matchesRuleFilter(diag, "all")).toBe(true);
  });

  it("matches by rule name", () => {
    expect(matchesRuleFilter(diag, ["no-floating-promises"])).toBe(true);
  });

  it("matches by full code string", () => {
    expect(matchesRuleFilter(diag, ["typescript(no-floating-promises)"])).toBe(true);
  });

  it("rejects non-matching rules", () => {
    expect(matchesRuleFilter(diag, ["no-unused-vars"])).toBe(false);
  });

  it("rejects diagnostics without code", () => {
    const noCode = { ...diag, code: undefined };
    expect(matchesRuleFilter(noCode, ["no-floating-promises"])).toBe(false);
  });
});
