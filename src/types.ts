/**
 * Types representing oxlint's `--format json` output structure.
 */

/** Root JSON output from `oxlint --format json` */
export interface OxlintJsonOutput {
  diagnostics: OxlintDiagnostic[];
  number_of_files: number;
  number_of_rules: number;
  threads_count: number;
  start_time: number;
}

/** A single diagnostic from oxlint */
export interface OxlintDiagnostic {
  /** Main error/warning message */
  message: string;
  /** Rule identifier, e.g. "eslint(no-debugger)" or "typescript(no-floating-promises)" */
  code?: string;
  /** Severity level */
  severity: "error" | "warning" | "advice";
  /** Cause chain (usually empty for lint diagnostics) */
  causes: string[];
  /** URL to rule documentation */
  url?: string;
  /** Help text suggesting a fix */
  help?: string;
  /** Additional note */
  note?: string;
  /** File path */
  filename: string;
  /** Source location labels */
  labels: OxlintLabel[];
  /** Related diagnostics */
  related: OxlintDiagnostic[];
}

/** A labeled source span */
export interface OxlintLabel {
  /** Optional descriptive label for this span */
  label?: string;
  /** Source location */
  span: OxlintSpan;
}

/** A source span with offset, length, and position */
export interface OxlintSpan {
  /** Byte offset in the file (0-indexed) */
  offset: number;
  /** Length of the span in bytes */
  length: number;
  /** Line number (1-indexed) */
  line: number;
  /** Column number (1-indexed) */
  column: number;
}

/** Options for the bridge plugin */
export interface BridgeOptions {
  /** Enable type-aware linting (passes --type-aware to oxlint) */
  typeAware?: boolean;
  /**
   * Which oxlint rules to bridge.
   * - "all" (default): bridge all diagnostics oxlint produces
   * - string[]: only bridge diagnostics from these specific rules
   */
  rules?: "all" | string[];
  /** Paths to lint (defaults to ["."]). Passed directly to oxlint. */
  paths?: string[];
  /** Path to the oxlint binary. Auto-detected if not specified. */
  binary?: string;
  /** Extra CLI arguments to pass to oxlint */
  extraArgs?: string[];
  /**
   * File extensions to attach the processor to.
   * Defaults to ["js", "mjs", "cjs", "jsx", "ts", "mts", "cts", "tsx"]
   */
  extensions?: string[];
}

/** ESLint LintMessage shape (subset relevant for bridge) */
export interface LintMessage {
  ruleId: string | null;
  severity: 1 | 2;
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}
