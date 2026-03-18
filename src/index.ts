import { resolve } from "node:path";
import type { BridgeOptions, OxlintDiagnostic, LintMessage } from "./types.js";
import { runOxlint } from "./runner.js";
import { mapDiagnostic, matchesRuleFilter } from "./mapper.js";
import { findOxlintBinary } from "./binary.js";

export type { BridgeOptions, OxlintDiagnostic, LintMessage } from "./types.js";
export { parseRuleId, mapSeverity, mapDiagnostic, matchesRuleFilter } from "./mapper.js";
export { findOxlintBinary } from "./binary.js";
export { buildCliArgs, parseOxlintOutput } from "./runner.js";

const DEFAULT_EXTENSIONS = ["js", "mjs", "cjs", "jsx", "ts", "mts", "cts", "tsx"];

/**
 * Create an ESLint flat config that bridges oxlint diagnostics into ESLint's reporting.
 *
 * oxlint is invoked exactly once per ESLint run (lazily, on the first file processed).
 * Results are cached and distributed to each file via an ESLint processor.
 *
 * @example
 * ```js
 * // eslint.config.js
 * import oxlintBridge from "eslint-oxlint-bridge";
 *
 * export default [
 *   oxlintBridge({ typeAware: true }),
 *   // ... other configs
 * ];
 * ```
 */
export default function oxlintBridge(options: BridgeOptions = {}): Record<string, unknown> {
  const ruleFilter = options.rules ?? "all";
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;

  // Validate binary exists early (at config time) for fast feedback
  findOxlintBinary(options.binary);

  // Closure-scoped cache: oxlint runs once, results shared across all files
  let cachedResults: Map<string, OxlintDiagnostic[]> | null = null;
  let cachedError: string | null = null;

  const plugin = {
    meta: {
      name: "eslint-oxlint-bridge",
      version: "0.1.0",
    },
    processors: {
      bridge: {
        // Pass through file contents unchanged — ESLint's own rules still run
        preprocess(text: string, _filename: string): Array<string | { text: string; filename: string }> {
          return [text];
        },

        // After ESLint's rules have run, inject oxlint's diagnostics
        postprocess(messages: LintMessage[][], filename: string): LintMessage[] {
          // Lazily run oxlint on first file
          if (cachedResults === null && cachedError === null) {
            try {
              cachedResults = runOxlint(options);
            } catch (err: unknown) {
              cachedError =
                err instanceof Error ? err.message : String(err);
            }
          }

          // Start with ESLint's own messages (from the single block we returned in preprocess)
          const eslintMessages = messages[0] ?? [];

          // If oxlint errored, report it as a single diagnostic on the first file only
          if (cachedError !== null) {
            const error = cachedError;
            // Clear so we only report it once
            cachedError = "";
            if (error) {
              return [
                ...eslintMessages,
                {
                  ruleId: "oxlint/bridge-error",
                  severity: 2,
                  message: `eslint-oxlint-bridge: ${error}`,
                  line: 1,
                  column: 1,
                },
              ];
            }
            return eslintMessages;
          }

          // Look up oxlint diagnostics for this file
          const absPath = resolve(filename);
          const oxlintDiags = cachedResults?.get(absPath) ?? [];

          // Filter and map oxlint diagnostics
          const bridgedMessages = oxlintDiags
            .filter((d) => matchesRuleFilter(d, ruleFilter))
            .map(mapDiagnostic);

          return [...eslintMessages, ...bridgedMessages];
        },

        supportsAutofix: false,
      },
    },
    rules: {
      // Warning rule: detects redundant type computation
      "no-redundant-type-aware": {
        meta: {
          type: "suggestion" as const,
          docs: {
            description:
              "Warns when ESLint type-aware parsing is enabled alongside the oxlint bridge",
          },
          messages: {
            redundant:
              'ESLint type-aware parsing is enabled alongside oxlint bridge. Consider removing `parserOptions.project` or `parserOptions.projectService` from your ESLint config — oxlint handles type computation via --type-aware.',
          },
          schema: [],
        },
        create(context: {
          parserOptions?: {
            project?: unknown;
            projectService?: unknown;
          };
          report: (descriptor: {
            loc: { start: { line: number; column: number } };
            messageId: string;
          }) => void;
          filename: string;
        }) {
          // Only warn if the bridge is configured with typeAware
          if (!options.typeAware) return {};

          const parserOpts = context.parserOptions;
          if (!parserOpts) return {};

          const hasProject = parserOpts.project != null;
          const hasProjectService = parserOpts.projectService != null && parserOpts.projectService !== false;

          if (hasProject || hasProjectService) {
            return {
              Program() {
                context.report({
                  loc: { start: { line: 1, column: 0 } },
                  messageId: "redundant",
                });
              },
            };
          }

          return {};
        },
      },
    },
  };

  const extGlob = extensions.map((e) => `**/*.${e}`);

  return {
    plugins: {
      "oxlint-bridge": plugin,
    },
    processor: "oxlint-bridge/bridge",
    files: extGlob,
    rules: options.typeAware
      ? { "oxlint-bridge/no-redundant-type-aware": "warn" }
      : {},
  };
}
