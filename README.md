# eslint-oxlint-bridge

[![npm version](https://img.shields.io/npm/v/eslint-oxlint-bridge.svg)](https://www.npmjs.com/package/eslint-oxlint-bridge)
[![license](https://img.shields.io/npm/l/eslint-oxlint-bridge.svg)](./LICENSE)

ESLint plugin that bridges [oxlint](https://oxc.rs) diagnostics into ESLint's reporting pipeline. Run `eslint .` and get a **single unified report** containing both ESLint-native and oxlint-bridged diagnostics.

## Why?

Many teams run both ESLint (for ecosystem plugins like React hooks, import ordering) and [oxlint](https://oxc.rs) (for speed on general and type-aware rules). Today that means two commands, two output formats, two exit codes:

```bash
eslint . && oxlint --type-aware .
```

This plugin merges them into one:

```bash
eslint .   # includes oxlint diagnostics
```

- **One report** — IDE extensions, CI formatters (`--format json`, `--format sarif`), GitHub Actions annotations, and review tools all see the full picture
- **One command** — simplifies CI, pre-commit hooks, and developer workflows
- **Fast type-aware linting** — oxlint computes TypeScript types in Rust, so you can drop ESLint's slow `parserOptions.projectService`

## Install

```bash
npm add -D eslint-oxlint-bridge oxlint
```

Requires **Node.js >= 18** and **ESLint >= 9** (flat config).

## Quick Start

```js
// eslint.config.js
import oxlintBridge from "eslint-oxlint-bridge";

export default [
  // Your existing ESLint configs
  myExistingConfig,

  // Bridge oxlint diagnostics into ESLint's output
  oxlintBridge(),
];
```

CommonJS configs work too:

```js
// eslint.config.js
const oxlintBridge = require("eslint-oxlint-bridge");

module.exports = [
  myExistingConfig,
  oxlintBridge(),
];
```

## Type-Aware Linting

To enable type-aware rules (e.g., `no-floating-promises`, `await-thenable`, `no-misused-promises`), pass `typeAware: true`. oxlint discovers your `tsconfig.json` automatically:

```js
oxlintBridge({ typeAware: true })
```

> **Important:** You do NOT need `parserOptions.projectService` or `parserOptions.project` in your ESLint config when using the bridge for type-aware rules. oxlint handles type computation independently in Rust. The plugin warns if both are enabled, since that would compute types twice for no benefit.

## Filter to Specific Rules

By default, all oxlint diagnostics are bridged. To only bridge specific rules:

```js
oxlintBridge({
  rules: ["no-floating-promises", "no-unused-vars"],
})
```

Filtering happens client-side after oxlint runs — oxlint still runs all its enabled rules in a single pass (one type graph computation), and the bridge filters in Node.js (essentially free).

## Use with eslint-plugin-oxlint

The bridge complements [eslint-plugin-oxlint](https://github.com/oxc-project/eslint-plugin-oxlint), which disables ESLint rules that oxlint already covers. Use both together to avoid duplicate diagnostics:

```js
import oxlintBridge from "eslint-oxlint-bridge";
import oxlint from "eslint-plugin-oxlint";

export default [
  myConfig,
  oxlintBridge({ typeAware: true }),      // Bridge oxlint results into ESLint
  oxlint.configs["flat/recommended"],      // Disable ESLint copies of bridged rules
];
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `typeAware` | `boolean` | `false` | Pass `--type-aware` to oxlint |
| `rules` | `"all" \| string[]` | `"all"` | Which oxlint rules to bridge (client-side filter) |
| `paths` | `string[]` | `["."]` | Paths for oxlint to lint |
| `binary` | `string` | auto-detected | Explicit path to the oxlint binary |
| `extraArgs` | `string[]` | `[]` | Extra CLI arguments passed to oxlint |
| `extensions` | `string[]` | `["js","mjs","cjs","jsx","ts","mts","cts","tsx"]` | File extensions the processor attaches to |

## How It Works

1. The plugin registers an ESLint [processor](https://eslint.org/docs/latest/extend/plugins#processors-in-plugins) that attaches to configured file extensions
2. On the first file processed, oxlint is spawned **once** with `--format json`
3. JSON output is parsed and cached in a `Map<filePath, diagnostics[]>`
4. For each file ESLint processes, `postprocess` looks up that file's oxlint diagnostics and merges them with ESLint's own messages
5. Diagnostics appear with `oxlint/`-prefixed rule IDs

### Performance

- oxlint is invoked **exactly once** per ESLint run, not per-file
- Type information (when `typeAware: true`) is computed **once** by oxlint's Rust-based type resolver
- Rule filtering is done in Node.js after oxlint runs (essentially free)

## Rule ID Format

oxlint diagnostics appear with namespaced rule IDs so you can tell which linter produced them:

| oxlint code | ESLint ruleId |
|-------------|---------------|
| `eslint(no-debugger)` | `oxlint/eslint/no-debugger` |
| `typescript(no-floating-promises)` | `oxlint/typescript/no-floating-promises` |
| `react(no-direct-mutation-state)` | `oxlint/react/no-direct-mutation-state` |
| `unicorn(no-null)` | `oxlint/unicorn/no-null` |

## Limitations

- **No fix passthrough** — oxlint's JSON output doesn't include fix ranges, so `eslint --fix` cannot apply oxlint fixes. Run `oxlint --fix` separately for auto-fixable rules.
- **ESLint v9+ only** — requires flat config. Legacy `.eslintrc` is not supported.
- **Synchronous execution** — oxlint is spawned via `execFileSync`, which is fine since ESLint's processor API is synchronous.

## Binary Resolution

The plugin finds the oxlint binary in this order:

1. Explicit `binary` option
2. `require.resolve("oxlint")` (from `node_modules`)
3. `which oxlint` (global install / PATH)
4. Throws a clear error: *"oxlint binary not found. Install it: `npm add -D oxlint`"*

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, project structure, and pull request guidelines.

## License

[MIT](./LICENSE)
