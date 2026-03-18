# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-17

### Added

- Initial release
- ESLint processor that bridges oxlint diagnostics into ESLint's reporting pipeline
- oxlint invoked exactly once per ESLint run (not per-file)
- Type-aware linting support via `typeAware: true` option
- Rule filtering — bridge all rules or a specific subset
- Automatic oxlint binary discovery (explicit path, node_modules, PATH)
- `oxlint/category/rule-name` namespaced rule IDs (e.g., `oxlint/eslint/no-debugger`)
- Severity mapping: oxlint error → ESLint 2, warning/advice → ESLint 1
- Help text appended to diagnostic messages
- `no-redundant-type-aware` warning rule (detects when ESLint and oxlint both compute types)
- CommonJS support for `require()`-based ESLint configs
- Configurable file extensions, lint paths, and extra CLI args
- Clear error messages when oxlint binary is missing
- Unit tests for mapping, parsing, binary discovery
- Integration tests with mocked oxlint output
- End-to-end tests with real oxlint binary
