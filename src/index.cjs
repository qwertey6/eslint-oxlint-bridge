// CJS wrapper for eslint-oxlint-bridge
// ESLint flat config files that use require() need this

const { resolve } = require("node:path");
const { execFileSync } = require("node:child_process");
const { existsSync, readFileSync } = require("node:fs");
const { createRequire } = require("node:module");
const { dirname } = require("node:path");

// -- binary.ts --
function findOxlintBinary(explicitPath) {
  if (explicitPath) {
    if (!existsSync(explicitPath)) {
      throw new Error(`eslint-oxlint-bridge: Specified oxlint binary not found at "${explicitPath}"`);
    }
    return explicitPath;
  }
  try {
    const req = createRequire(__filename);
    const oxlintPkg = req.resolve("oxlint/package.json");
    const pkg = JSON.parse(readFileSync(oxlintPkg, "utf-8"));
    if (pkg.bin) {
      const binRelative = typeof pkg.bin === "string" ? pkg.bin : pkg.bin["oxlint"];
      if (binRelative) {
        const binPath = resolve(dirname(oxlintPkg), binRelative);
        if (existsSync(binPath)) return binPath;
      }
    }
  } catch {}
  try {
    const result = execFileSync("which", ["oxlint"], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (result && existsSync(result)) return result;
  } catch {}
  throw new Error(
    "eslint-oxlint-bridge: oxlint binary not found. Install it: `npm add -D oxlint`"
  );
}

// -- mapper.ts --
function parseRuleId(code) {
  if (!code) return null;
  const match = code.match(/^([^(]+)\(([^)]+)\)$/);
  if (match) return `oxlint/${match[1]}/${match[2]}`;
  return `oxlint/${code}`;
}

function mapSeverity(severity) {
  return severity === "error" ? 2 : 1;
}

function buildMessage(diagnostic) {
  let msg = diagnostic.message;
  if (diagnostic.help) msg += ` (${diagnostic.help})`;
  return msg;
}

function mapDiagnostic(diagnostic) {
  const primaryLabel = diagnostic.labels[0];
  const message = {
    ruleId: parseRuleId(diagnostic.code),
    severity: mapSeverity(diagnostic.severity),
    message: buildMessage(diagnostic),
    line: primaryLabel?.span.line ?? 1,
    column: primaryLabel?.span.column ?? 1,
  };
  if (primaryLabel && primaryLabel.span.length > 0) {
    message.endLine = primaryLabel.span.line;
    message.endColumn = primaryLabel.span.column + primaryLabel.span.length;
  }
  return message;
}

function matchesRuleFilter(diagnostic, rules) {
  if (rules === "all") return true;
  const code = diagnostic.code;
  if (!code) return false;
  const match = code.match(/^[^(]+\(([^)]+)\)$/);
  const ruleName = match ? match[1] : code;
  return rules.includes(ruleName) || rules.includes(code);
}

// -- runner.ts --
function buildCliArgs(options) {
  const args = ["--format", "json"];
  if (options.typeAware) args.push("--type-aware");
  if (options.extraArgs) args.push(...options.extraArgs);
  const paths = options.paths ?? ["."];
  args.push(...paths);
  return args;
}

function parseOxlintOutput(stdout) {
  const results = new Map();
  if (!stdout.trim()) return results;
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(
      `eslint-oxlint-bridge: Failed to parse oxlint JSON output. Output starts with: ${stdout.slice(0, 200)}`
    );
  }
  if (!parsed.diagnostics || !Array.isArray(parsed.diagnostics)) return results;
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

function runOxlint(options) {
  const binary = findOxlintBinary(options.binary);
  const args = buildCliArgs(options);
  let stdout;
  try {
    stdout = execFileSync(binary, args, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 100 * 1024 * 1024,
    });
  } catch (err) {
    if (err.stdout) {
      stdout = err.stdout;
    } else {
      const stderr = err.stderr ?? String(err);
      throw new Error(`eslint-oxlint-bridge: oxlint crashed or failed to run.\n${stderr}`);
    }
  }
  return parseOxlintOutput(stdout);
}

// -- index.ts --
const DEFAULT_EXTENSIONS = ["js", "mjs", "cjs", "jsx", "ts", "mts", "cts", "tsx"];

function oxlintBridge(options = {}) {
  const ruleFilter = options.rules ?? "all";
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;

  findOxlintBinary(options.binary);

  let cachedResults = null;
  let cachedError = null;

  const plugin = {
    meta: { name: "eslint-oxlint-bridge", version: "0.1.0" },
    processors: {
      bridge: {
        preprocess(text, _filename) {
          return [text];
        },
        postprocess(messages, filename) {
          if (cachedResults === null && cachedError === null) {
            try {
              cachedResults = runOxlint(options);
            } catch (err) {
              cachedError = err instanceof Error ? err.message : String(err);
            }
          }
          const eslintMessages = messages[0] ?? [];
          if (cachedError !== null) {
            const error = cachedError;
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
          const absPath = resolve(filename);
          const oxlintDiags = cachedResults?.get(absPath) ?? [];
          const bridgedMessages = oxlintDiags
            .filter((d) => matchesRuleFilter(d, ruleFilter))
            .map(mapDiagnostic);
          return [...eslintMessages, ...bridgedMessages];
        },
        supportsAutofix: false,
      },
    },
    rules: {
      "no-redundant-type-aware": {
        meta: {
          type: "suggestion",
          docs: { description: "Warns when ESLint type-aware parsing is enabled alongside oxlint bridge" },
          messages: {
            redundant: "ESLint type-aware parsing is enabled alongside oxlint bridge. Consider removing `parserOptions.project` or `parserOptions.projectService` from your ESLint config.",
          },
          schema: [],
        },
        create(context) {
          if (!options.typeAware) return {};
          const parserOpts = context.parserOptions;
          if (!parserOpts) return {};
          const hasProject = parserOpts.project != null;
          const hasProjectService = parserOpts.projectService != null && parserOpts.projectService !== false;
          if (hasProject || hasProjectService) {
            return {
              Program() {
                context.report({ loc: { start: { line: 1, column: 0 } }, messageId: "redundant" });
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
    plugins: { "oxlint-bridge": plugin },
    processor: "oxlint-bridge/bridge",
    files: extGlob,
    rules: options.typeAware ? { "oxlint-bridge/no-redundant-type-aware": "warn" } : {},
  };
}

module.exports = oxlintBridge;
module.exports.default = oxlintBridge;
module.exports.oxlintBridge = oxlintBridge;
