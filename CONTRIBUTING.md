# Contributing to eslint-oxlint-bridge

Thanks for your interest in contributing! This project bridges oxlint diagnostics into ESLint's reporting pipeline, and we welcome bug reports, feature requests, and pull requests.

## Reporting Issues

- Search [existing issues](https://github.com/qwertey6/eslint-oxlint-bridge/issues) before opening a new one
- Include your versions: Node.js, ESLint, oxlint, and this package
- For bugs, include a minimal reproduction (ESLint config + source file that demonstrates the issue)
- Paste the relevant ESLint output and the expected output

## Development Setup

```bash
git clone https://github.com/qwertey6/eslint-oxlint-bridge.git
cd eslint-oxlint-bridge
npm install
npm run build
npm test
```

### Prerequisites

- Node.js >= 18
- [oxlint](https://oxc.rs) installed globally or in a test project's `node_modules` (needed for e2e tests)

### Project Structure

```
src/
  index.ts       Main entry — oxlintBridge() function, ESLint processor & warning rule
  types.ts       TypeScript types for oxlint JSON output and bridge options
  binary.ts      oxlint binary discovery (explicit path → node_modules → PATH)
  runner.ts      Spawns oxlint, parses JSON output, groups by file
  mapper.ts      Maps oxlint diagnostics to ESLint LintMessage objects
  index.cjs      CommonJS wrapper for require()-based ESLint configs

test/
  mapper.test.ts       Unit tests for diagnostic mapping
  runner.test.ts       Unit tests for CLI arg building and JSON parsing
  binary.test.ts       Unit tests for binary discovery
  integration.test.ts  Integration tests with mocked oxlint output
  e2e.test.ts          End-to-end tests with real oxlint binary (skipped if unavailable)
  fixtures/            Sample projects for e2e tests
```

### Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm test` | Run all tests (vitest) |
| `npm run test:watch` | Run tests in watch mode |

### Running E2E Tests

The e2e tests use a real oxlint binary. They're automatically skipped if oxlint isn't available. To run them:

```bash
npm install -g oxlint   # or add oxlint to devDependencies
npm test
```

## Pull Requests

1. Fork the repo and create a branch from `main`
2. Add tests for any new functionality
3. Ensure `npm test` passes
4. Ensure `npm run build` succeeds
5. Keep PRs focused — one feature or fix per PR
6. Update the README if you're changing user-facing behavior

### Code Style

- TypeScript strict mode
- No `any` types unless absolutely necessary
- Named exports preferred over default (except the main `oxlintBridge` function)
- Keep the CJS wrapper (`src/index.cjs`) in sync with any changes to the ESM source

### Updating the CJS Wrapper

The `src/index.cjs` file is a hand-written CommonJS version of the plugin for `require()`-based ESLint configs. If you change the public API or core logic in the ESM source files, you must also update `index.cjs` to match. This is intentional — the CJS file avoids a build tool dependency and keeps the package simple.

## Commit Messages

Use [conventional commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only
- `test:` — adding or updating tests
- `chore:` — maintenance (deps, CI, etc.)

## Code of Conduct

Be respectful. We're here to build useful tools together.
