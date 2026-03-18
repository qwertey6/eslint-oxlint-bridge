import type { OxlintDiagnostic, LintMessage } from "./types.js";

/**
 * Parse oxlint's `code` field (e.g. "eslint(no-debugger)") into a namespaced ruleId.
 * Returns "oxlint/eslint/no-debugger" format.
 * If no code is present, returns null.
 */
export function parseRuleId(code: string | undefined): string | null {
  if (!code) return null;

  // Format: "category(rule-name)" e.g. "eslint(no-debugger)", "typescript(no-floating-promises)"
  const match = code.match(/^([^(]+)\(([^)]+)\)$/);
  if (match) {
    return `oxlint/${match[1]}/${match[2]}`;
  }

  // Fallback: just prefix with oxlint/
  return `oxlint/${code}`;
}

/**
 * Map oxlint severity to ESLint severity number.
 * "error" → 2, "warning" → 1, "advice" → 1
 */
export function mapSeverity(severity: string): 1 | 2 {
  return severity === "error" ? 2 : 1;
}

/**
 * Build the diagnostic message, optionally including help text.
 */
export function buildMessage(diagnostic: OxlintDiagnostic): string {
  let msg = diagnostic.message;
  if (diagnostic.help) {
    msg += ` (${diagnostic.help})`;
  }
  return msg;
}

/**
 * Map an oxlint diagnostic to an ESLint LintMessage.
 */
export function mapDiagnostic(diagnostic: OxlintDiagnostic): LintMessage {
  const primaryLabel = diagnostic.labels[0];

  const message: LintMessage = {
    ruleId: parseRuleId(diagnostic.code),
    severity: mapSeverity(diagnostic.severity),
    message: buildMessage(diagnostic),
    // Default to line 1, column 1 if no label (shouldn't happen for lint diagnostics)
    line: primaryLabel?.span.line ?? 1,
    column: primaryLabel?.span.column ?? 1,
  };

  // If the span has length, compute endLine/endColumn
  // Note: oxlint only provides offset+length, not endLine/endColumn directly.
  // We set endLine = line and endColumn = column + length as a reasonable approximation
  // for single-line spans. Multi-line span end positions would need source text to compute accurately.
  if (primaryLabel && primaryLabel.span.length > 0) {
    message.endLine = primaryLabel.span.line;
    message.endColumn = primaryLabel.span.column + primaryLabel.span.length;
  }

  return message;
}

/**
 * Check if a diagnostic's rule matches the filter list.
 * If rules is "all", all diagnostics pass.
 * Otherwise, the rule name (without category prefix) must be in the list.
 */
export function matchesRuleFilter(
  diagnostic: OxlintDiagnostic,
  rules: "all" | string[],
): boolean {
  if (rules === "all") return true;

  const code = diagnostic.code;
  if (!code) return false;

  // Extract rule name from "category(rule-name)"
  const match = code.match(/^[^(]+\(([^)]+)\)$/);
  const ruleName = match ? match[1] : code;

  return rules.includes(ruleName) || rules.includes(code);
}
