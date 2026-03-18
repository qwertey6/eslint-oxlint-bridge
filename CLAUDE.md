# CLAUDE.md

ESLint plugin that bridges oxlint diagnostics into ESLint's reporting pipeline via an ESLint processor.

## Architecture

oxlint is spawned **once** per ESLint run (not per-file). The processor's `postprocess` lazily invokes oxlint on first call, caches results in a closure-scoped `Map<absPath, diagnostics[]>`, and merges each file's oxlint diagnostics into ESLint's messages.

```
eslint.config.js → oxlintBridge(options) → flat config with processor
                                              ↓
                              postprocess (1st file) → execFileSync("oxlint --format json .")
                                              ↓                         ↓
                              postprocess (Nth file) ← cache: Map<path, diags>
                                              ↓
                              [...eslintMessages, ...oxlintMessages]
```

### Key design decisions

- **Processor, not rule** — processors can set custom `ruleId` per message; rules can't
- **Client-side rule filtering** — oxlint always runs all rules once (one type graph), filtering is free in JS
- **CJS wrapper** — `src/index.cjs` is hand-maintained (not generated) for `require()`-based configs
- **No fix passthrough** — oxlint's JSON output lacks fix ranges; this is an upstream limitation

## Source files

| File | Purpose |
|------|---------|
| `src/index.ts` | Main export: `oxlintBridge()`, processor, `no-redundant-type-aware` rule |
| `src/types.ts` | Types for oxlint JSON output, bridge options, ESLint LintMessage |
| `src/binary.ts` | `findOxlintBinary()` — explicit path → node_modules → PATH |
| `src/runner.ts` | `runOxlint()` — spawn, parse JSON, group by file path |
| `src/mapper.ts` | `mapDiagnostic()` — oxlint diagnostic → ESLint LintMessage |
| `src/index.cjs` | Hand-written CJS copy of the full plugin (keep in sync with ESM) |

## Commands

```bash
npm run build     # tsc + copy index.cjs to dist/
npm test          # vitest (41 tests, e2e skipped without oxlint binary)
npm run test:watch
```

## Tests

- `test/mapper.test.ts` — rule ID parsing, severity mapping, message building, filtering
- `test/runner.test.ts` — CLI arg generation, JSON parsing, edge cases
- `test/binary.test.ts` — binary discovery
- `test/integration.test.ts` — full mapping pipeline with mocked output
- `test/e2e.test.ts` — real oxlint binary against fixtures (auto-skipped if unavailable)

## oxlint JSON format

```json
{
  "diagnostics": [{
    "message": "...",
    "code": "eslint(no-debugger)",     // → ruleId: "oxlint/eslint/no-debugger"
    "severity": "error",                // → 2 (warning/advice → 1)
    "labels": [{ "span": { "offset": 0, "length": 9, "line": 1, "column": 1 } }],
    "filename": "src/test.js",
    "help": "Remove the debugger statement",  // appended to message in parens
    "causes": [], "related": []
  }],
  "number_of_files": 1, "number_of_rules": 93, "threads_count": 16, "start_time": 0.01
}
```

## Changing the CJS wrapper

If you modify the public API or core logic in the ESM source, you **must** update `src/index.cjs` to match. It's a standalone file — no build step generates it.
