# eslint-oxlint-bridge

ESLint plugin that bridges [oxlint](https://oxc.rs) diagnostics into ESLint's reporting pipeline. Run `eslint .` and get a **single unified report** containing both ESLint-native and oxlint-bridged diagnostics.

## Why?

- **One report**: IDE extensions, CI formatters, GitHub Actions annotations all see the full picture
- **One command**: `eslint .` instead of `eslint . && oxlint .`
- **Fast type-aware linting**: oxlint computes TypeScript types in Rust — no need for ESLint's slow `parserOptions.projectService`

## Install

```bash
npm add -D eslint-oxlint-bridge oxlint
```

## Usage

```js
// eslint.config.js
import oxlintBridge from "eslint-oxlint-bridge";

export default [
  // Your existing ESLint configs (React hooks, import ordering, etc.)
  myExistingConfig,

  // Bridge oxlint diagnostics into ESLint's output
  oxlintBridge(),
];
```

### Type-aware linting

To enable type-aware rules (e.g., `no-floating-promises`, `await-thenable`), pass `typeAware: true`. oxlint will discover your `tsconfig.json` automatically:

```js
oxlintBridge({ typeAware: true })
```

> **Important**: When using the bridge with `typeAware: true`, you do NOT need `parserOptions.projectService` or `parserOptions.project` in your ESLint config. oxlint handles type computation independently. The plugin will warn if both are enabled.

### Filter to specific rules

By default, all oxlint diagnostics are bridged. To only bridge specific rules:

```js
oxlintBridge({
  rules: ["no-floating-promises", "no-unused-vars"],
})
```

Filtering happens client-side (in Node.js) after oxlint runs — oxlint still runs all its enabled rules in a single pass, so there's no performance cost.

### Use with eslint-plugin-oxlint

The bridge complements [eslint-plugin-oxlint](https://github.com/oxc-project/eslint-plugin-oxlint) (which disables overlapping ESLint rules):

```js
import oxlintBridge from "eslint-oxlint-bridge";
import oxlint from "eslint-plugin-oxlint";

export default [
  myConfig,
  oxlintBridge({ typeAware: true }),       // Bridge oxlint results into ESLint
  oxlint.configs["flat/recommended"],       // Disable ESLint rules oxlint covers
];
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `typeAware` | `boolean` | `false` | Pass `--type-aware` to oxlint |
| `rules` | `"all" \| string[]` | `"all"` | Which oxlint rules to bridge |
| `paths` | `string[]` | `["."]` | Paths to lint (passed to oxlint) |
| `binary` | `string` | auto-detected | Path to the oxlint binary |
| `extraArgs` | `string[]` | `[]` | Extra CLI arguments for oxlint |
| `extensions` | `string[]` | `["js","mjs","cjs","jsx","ts","mts","cts","tsx"]` | File extensions to process |

## How it works

1. The plugin registers an ESLint **processor** that attaches to configured file extensions
2. On the first file processed, oxlint is spawned **once** with `--format json`
3. The JSON output is parsed and cached in a `Map<filePath, diagnostics[]>`
4. For each file ESLint processes, the processor's `postprocess` looks up that file's oxlint diagnostics and merges them with ESLint's own messages
5. Diagnostics appear in ESLint's output with `oxlint/` prefixed rule IDs (e.g., `oxlint/eslint/no-debugger`)

### Performance characteristics

- oxlint is invoked **exactly once** per ESLint run, not per-file
- Type information (when `typeAware: true`) is computed **once** by oxlint's Rust-based type resolver
- Rule filtering is done in Node.js after oxlint runs (essentially free)

## Limitations

- **No fix passthrough**: oxlint's JSON output doesn't include fix ranges, so `eslint --fix` cannot apply oxlint fixes. Run `oxlint --fix` separately.
- **ESLint v9+ only**: Requires ESLint flat config. Legacy `.eslintrc` is not supported.
- **Synchronous execution**: oxlint is spawned synchronously (via `execFileSync`), which is fine since ESLint's plugin API is synchronous.

## Rule ID format

oxlint diagnostics appear with namespaced rule IDs:

| oxlint code | ESLint ruleId |
|-------------|---------------|
| `eslint(no-debugger)` | `oxlint/eslint/no-debugger` |
| `typescript(no-floating-promises)` | `oxlint/typescript/no-floating-promises` |
| `react(no-direct-mutation-state)` | `oxlint/react/no-direct-mutation-state` |
| `unicorn(no-null)` | `oxlint/unicorn/no-null` |

## License

MIT
