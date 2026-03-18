import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

/**
 * Finds the oxlint binary using the following resolution order:
 * 1. Explicit path (if provided)
 * 2. require.resolve("oxlint") — finds it in node_modules
 * 3. `which oxlint` — finds it on PATH
 * 4. Throws with a clear error
 */
export function findOxlintBinary(explicitPath?: string): string {
  // 1. Explicit path
  if (explicitPath) {
    if (!existsSync(explicitPath)) {
      throw new Error(
        `eslint-oxlint-bridge: Specified oxlint binary not found at "${explicitPath}"`,
      );
    }
    return explicitPath;
  }

  // 2. Try require.resolve to find node_modules binary
  try {
    const req = createRequire(import.meta.url);
    const oxlintPkg = req.resolve("oxlint/package.json");
    const pkg = JSON.parse(readFileSync(oxlintPkg, "utf-8")) as {
      bin?: Record<string, string> | string;
    };
    if (pkg.bin) {
      const binRelative =
        typeof pkg.bin === "string" ? pkg.bin : pkg.bin["oxlint"];
      if (binRelative) {
        const binPath = resolve(dirname(oxlintPkg), binRelative);
        if (existsSync(binPath)) {
          return binPath;
        }
      }
    }
  } catch {
    // Not installed as a dependency, try next method
  }

  // 3. Try finding on PATH via `which`
  try {
    const result = execFileSync("which", ["oxlint"], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (result && existsSync(result)) {
      return result;
    }
  } catch {
    // Not on PATH
  }

  throw new Error(
    "eslint-oxlint-bridge: oxlint binary not found. Install it: `npm add -D oxlint`\n" +
      'Or specify the path explicitly: oxlintBridge({ binary: "/path/to/oxlint" })',
  );
}
