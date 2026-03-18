import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import type { BridgeOptions, OxlintJsonOutput, OxlintDiagnostic } from "./types.js";
import { findOxlintBinary } from "./binary.js";

/**
 * Build CLI arguments for oxlint from bridge options.
 */
export function buildCliArgs(options: BridgeOptions): string[] {
  const args: string[] = ["--format", "json"];

  if (options.typeAware) {
    args.push("--type-aware");
  }

  if (options.extraArgs) {
    args.push(...options.extraArgs);
  }

  // Paths to lint (default: current directory)
  const paths = options.paths ?? ["."];
  args.push(...paths);

  return args;
}

/**
 * Run oxlint and return diagnostics grouped by absolute file path.
 *
 * oxlint is invoked exactly once. Results are grouped into a Map
 * keyed by resolved absolute file path for efficient per-file lookup.
 */
export function runOxlint(
  options: BridgeOptions,
): Map<string, OxlintDiagnostic[]> {
  const binary = findOxlintBinary(options.binary);
  const args = buildCliArgs(options);

  let stdout: string;
  try {
    stdout = execFileSync(binary, args, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      // oxlint exits with non-zero when lint errors are found — that's normal
      maxBuffer: 100 * 1024 * 1024, // 100MB buffer for large projects
    });
  } catch (err: unknown) {
    // execFileSync throws on non-zero exit. For oxlint, exit code 1 means
    // "lint errors found" which is expected — we still want the stdout.
    const execErr = err as { stdout?: string; stderr?: string; status?: number };
    if (execErr.stdout) {
      stdout = execErr.stdout;
    } else {
      const stderr = execErr.stderr ?? String(err);
      throw new Error(
        `eslint-oxlint-bridge: oxlint crashed or failed to run.\n${stderr}`,
      );
    }
  }

  return parseOxlintOutput(stdout);
}

/**
 * Parse oxlint's JSON output into a Map of absolute filepath → diagnostics.
 */
export function parseOxlintOutput(
  stdout: string,
): Map<string, OxlintDiagnostic[]> {
  const results = new Map<string, OxlintDiagnostic[]>();

  if (!stdout.trim()) {
    return results;
  }

  let parsed: OxlintJsonOutput;
  try {
    parsed = JSON.parse(stdout) as OxlintJsonOutput;
  } catch {
    throw new Error(
      `eslint-oxlint-bridge: Failed to parse oxlint JSON output. ` +
        `Output starts with: ${stdout.slice(0, 200)}`,
    );
  }

  if (!parsed.diagnostics || !Array.isArray(parsed.diagnostics)) {
    return results;
  }

  for (const diagnostic of parsed.diagnostics) {
    const absPath = resolve(diagnostic.filename);
    let list = results.get(absPath);
    if (!list) {
      list = [];
      results.set(absPath, list);
    }
    list.push(diagnostic);
  }

  return results;
}
