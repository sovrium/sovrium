## [0.5.3](https://git.sovrium.com/sovrium/sovrium/compare/v0.5.2...v0.5.3) (2026-05-22)

### Bug Fixes

- **assets**: exclude .ts examples from the embedded manifest ([7b837e7c9](https://git.sovrium.com/sovrium/sovrium/commit/7b837e7c9))
- **types**: fix declaration-emit errors blocking the release build ([67c16fa61](https://git.sovrium.com/sovrium/sovrium/commit/67c16fa61))
- **build**: exclude binary-only embedded-runtime manifest from npm bundle ([a15ba58ca](https://git.sovrium.com/sovrium/sovrium/commit/a15ba58ca))
- **cli**: serve agents + init examples from embedded manifest ([a2b6efee0](https://git.sovrium.com/sovrium/sovrium/commit/a2b6efee0))
- **assets**: embed client/island/script bundles in the compiled binary ([3eb3d5b30](https://git.sovrium.com/sovrium/sovrium/commit/3eb3d5b30))
- **migrations**: embed drizzle migrations in the compiled binary ([abc1ecbcb](https://git.sovrium.com/sovrium/sovrium/commit/abc1ecbcb))
- **openapi**: resolve Sovrium version from build-time define in binaries ([3d30ec52e](https://git.sovrium.com/sovrium/sovrium/commit/3d30ec52e))

### Refactoring

- **version**: centralize Sovrium version resolution ([c7270861e](https://git.sovrium.com/sovrium/sovrium/commit/c7270861e))

### Styles

- prettier-ignore embedded manifests + format codegen script ([0b6010f7b](https://git.sovrium.com/sovrium/sovrium/commit/0b6010f7b))

### Chores

- **lint**: move eslint-disable to the flagged mkdir statement ([5bcaccddf](https://git.sovrium.com/sovrium/sovrium/commit/5bcaccddf))

### CI

- skip TDD post-test dispatch jobs while TDD pipeline is disabled ([a5995b209](https://git.sovrium.com/sovrium/sovrium/commit/a5995b209))

## [0.5.2](https://git.sovrium.com/sovrium/sovrium/compare/v0.5.1...v0.5.2) (2026-05-21)

Maintenance patch.

CI: fix the release aggregate-checksums job so Homebrew and Scoop manifests auto-update on release (pass --repo to the asset upload); the release gate now honors an explicit HEAD version tag over commit analysis.

Ops: disable TDD automation workflows (files retained); record the Coolify 4.0.0 → 4.1.0 upgrade.

## [0.5.1](https://git.sovrium.com/sovrium/sovrium/compare/v0.5.0...v0.5.1) (2026-05-21)

Maintenance patch.

BREAKING (shipped as patch by operator decision): SQLITE_PATH env var removed — configure the SQLite path via the DATABASE_URL `file:` scheme instead.

Also includes: CLI install/update fixes (Linux Homebrew/curl, Scoop checksum, source-agnostic `sovrium update`), release CI hardening (darwin-x64 cross-compile, HOMEBREW_TAP_TOKEN guard), parser-based HTML stripping in security utils, and theming visual-baseline deflake.

## [0.5.0](https://git.sovrium.com/sovrium/sovrium/compare/v0.4.10...v0.5.0) (2026-05-21)

Release 0.5.0

## [0.4.10](https://git.sovrium.com/sovrium/sovrium/compare/v0.4.9...v0.4.10) (2026-05-18)

Release 0.4.10

## [0.4.9](https://git.sovrium.com/sovrium/sovrium/compare/v0.4.8...v0.4.9) (2026-05-18)

Release 0.4.9

## [0.4.8](https://git.sovrium.com/sovrium/sovrium/compare/v0.4.7...v0.4.8) (2026-05-18)

Release 0.4.8

## [0.4.7](https://git.sovrium.com/sovrium/sovrium/compare/v0.4.6...v0.4.7) (2026-05-18)

Release 0.4.7

## [0.4.6](https://git.sovrium.com/sovrium/sovrium/compare/v0.4.5...v0.4.6) (2026-05-18)

Release 0.4.6

## [0.4.5](https://git.sovrium.com/sovrium/sovrium/compare/v0.4.4...v0.4.5) (2026-05-18)

Release 0.4.5

## [0.4.4](https://git.sovrium.com/sovrium/sovrium/compare/v0.4.3...v0.4.4) (2026-05-18)

Release 0.4.4

## [0.4.3](https://git.sovrium.com/sovrium/sovrium/compare/v0.4.2...v0.4.3) (2026-05-18)

Release 0.4.3

## [0.4.2](https://git.sovrium.com/sovrium/sovrium/compare/v0.4.1...v0.4.2) (2026-05-18)

Release 0.4.2

## [0.4.1](https://git.sovrium.com/sovrium/sovrium/compare/v0.4.0...v0.4.1) (2026-05-18)

Release 0.4.1

## [0.4.0](https://git.sovrium.com/sovrium/sovrium/compare/v0.3.0...v0.4.0) (2026-05-14)

Release 0.4.0

## [0.3.0](https://git.sovrium.com/sovrium/sovrium/compare/v0.2.11...v0.3.0) (2026-05-08)

Configuration & runtime API overhaul.

### BREAKING CHANGES

- `context.actions` API unified: use `actions.ref(name, vars)` and `actions.<type>.<op>(props)`
- `context.actions` now redirects to `app.actions[]` templates; `trigger` and `steps` removed from `CodeContext`
- `code/run` replaced by `code/runTypescript` with startup validation

### Features

- Coming-soon variant flagging via `#tag` annotations
- Runtime warnings on coming-soon feature usage at server boot
- `@deprecated COMING SOON` JSDoc injection in `@sovrium/types`
- Internal coming-soon manifest and `registry.generated.ts`
- `bun run progress` emits `schemas/coming-soon.json`
- CLI `validate` wires the coming-soon warner

### Bug Fixes

- Enforce `execute(context: CodeContext)` annotation in `runTypescript`
- Align `code/runTypescript` runtime with E2E spec contract

## [0.2.11](https://git.sovrium.com/sovrium/sovrium/compare/v0.2.10...v0.2.11) (2026-03-17)

Release 0.2.11

## [0.2.10](https://git.sovrium.com/sovrium/sovrium/compare/v0.2.9...v0.2.10) (2026-03-17)

Release 0.2.10

## [0.2.9](https://git.sovrium.com/sovrium/sovrium/compare/v0.2.8...v0.2.9) (2026-03-17)

Release 0.2.9

## [0.2.8](https://git.sovrium.com/sovrium/sovrium/compare/v0.2.7...v0.2.8) (2026-03-17)

Release 0.2.8

## [0.2.7](https://git.sovrium.com/sovrium/sovrium/compare/v0.2.6...v0.2.7) (2026-03-16)

Release 0.2.7

## [0.2.6](https://git.sovrium.com/sovrium/sovrium/compare/v0.2.5...v0.2.6) (2026-03-16)

Runtime CLI commands for schema export and config validation

## [0.2.5](https://git.sovrium.com/sovrium/sovrium/compare/v0.2.4...v0.2.5) (2026-03-16)

Polish GitHub mirror metadata for npm audience

# Changelog

## 0.2.4 (2026-03-16)

Initial public release on npm.

Sovrium is a configuration-driven application platform built with Bun, Effect, React, and Tailwind CSS.
