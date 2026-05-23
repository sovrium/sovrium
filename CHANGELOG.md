## [0.6.2](https://github.com/sovrium/sovrium/compare/v0.6.1...v0.6.2) (2026-05-23)

### Bug Fixes

- **release**: undraft GitHub Release before Homebrew/Scoop tap updates

### Tests

- **cli, records-api**: deflake watch-dev-port + presence-awareness selector

## [0.6.1](https://github.com/sovrium/sovrium/compare/v0.6.0...v0.6.1) (2026-05-22)

### Bug Fixes

- **release**: repoint binary smoke-tests to per-template app.yaml

## [0.6.0](https://github.com/sovrium/sovrium/compare/v0.5.3...v0.6.0) (2026-05-22)

### Features

- **cli**: add 3 starter templates + auto-install paired agent on init
- **cli**: array-element $ref resolves full-object-per-file (CLI-MULTIFILE-017..024)
- **markdown-pages**: emit code-block theme name in compiled CSS (cluster 6)
- **markdown-pages**: collection nav + docs prev/next + 'none' layout (cluster 5)
- **markdown-pages**: $t: i18n interpolation in body (cluster 4)
- **markdown-pages**: :::container::: directives -> SSR components (cluster 3)
- **markdown-pages**: Shiki SSR code highlighting (cluster 2)
- **markdown-pages**: GFM rendering via markdown-it (cluster 1)
- **markdown-pages**: scaffold schema + RED specs for rich markdown website
- **cli**: add 'admin create' + 'secret generate', document env in --help, scaffold .env.example
- **cli**: support TypeScript config files in build/schema loading
- **cli**: scaffold .gitignore + Sovrium-guide CLAUDE.md in `sovrium init`
- **server**: consolidate runtime artifacts under ./.sovrium/ data dir
- **cli**: serve static-asset directory + live SEO routes from `sovrium start`
- **dev**: inject dev live-reload script, absent in production
- **dev**: GET /__sovrium_dev/reload SSE endpoint
- **dev**: rebuild client + island bundles in dev (skip memo)
- **dev**: SOVRIUM_DEV_NO_CACHE bypass for CSS + page caches

### Bug Fixes

- **palette**: close the navigate-then-reopen race in the command palette
- **theme**: de-cycle --sv-fg fallback chain so zero-config tooltip renders
- **database**: make Better Auth validators dialect-aware (SQLite + Postgres)
- **markdown-pages**: preserve javascript:/data: links as href="#" sentinel
- **server**: warn about disabled email only when the config needs it
- **server**: stop NODE_ENV=development leaking dev behavior into test servers
- **cli**: gate dev-mode security warnings + quiet migration logs + add Mode banner phase
- **server**: keep the same port on watch reload, never silent port-0
- **cli**: clear CSS + page caches on watch reload
- **css**: include className candidate set in CSS cache key
- **release**: fail when generated Homebrew/Scoop manifest has placeholder checksums
- **cli**: qualify Homebrew formula as sovrium/tap/sovrium in update command
- **release**: fail when generated Homebrew/Scoop manifest has placeholder checksums
- **cli**: qualify Homebrew formula as sovrium/tap/sovrium in update command

### Performance Improvements

- **markdown**: extract content-dir filter helper + skip render probe in filter path

### Refactoring

- **release**: make changelog public-friendly (GitHub compare + no per-commit links)
- **theme**: rename --color-bg/--color-fg to shadcn-aligned canonical names
- **crud**: rename FieldShell to CrudFieldShell and scope to CRUD only
- **markdown**: freeze the shared renderer rules table
- **dev-mode**: extract isLocalDevDefault helper to domain layer
- **markdown**: hoist markdown-it engine to infrastructure layer
- **specs**: relocate markdown-pages fixtures to specs/fixtures/content/
- **cli**: rename .sovrium/ default artifacts for naming consistency
- **presentation**: polish CRUD form skeleton field structure
- **css**: add typography prose defaults to @layer base
- **css**: add focus-visible ring to raw interactive elements
- **presentation**: migrate tiptap placeholder to v1 token
- **presentation**: migrate file-upload trigger to v1 tokens
- **presentation**: auto-apply .btn variant/size classes + add .btn-fab
- **cli**: display relative paths in startup banner
- **email**: remove Mailpit runtime fallback; disable email when SMTP unconfigured
- **cli**: unify `sovrium build` output with the start banner
- **build**: isolate production build/release scripts under scripts/build/
- **dev**: extract memoizeUnlessDev helper for asset bundle providers
- **cli**: extract shared option-parsing helper for start/build
- **dev**: move dev-reload SSE handler to presentation layer + lint/format

### Documentation

- **infra**: document runner idle-check + wake-poller bug fix (2026-05-22)
- **infra**: refresh package docs to match current codebase
- **progress**: regenerate SPEC-PROGRESS.md + FEATURES.md after SQLite-validator fix landing
- **user-stories**: move CLI-INIT-AGENT-COPY-* into sibling init-agent-copy.md
- **user-stories**: mirror CLI-INIT-AGENT-COPY-001..005 into init.md
- **button**: clarify .btn auto-apply merge semantics
- **progress**: regenerate SPEC-PROGRESS.md + FEATURES.md after merging main
- **progress**: refresh SPEC-PROGRESS.md after CLI-MULTIFILE-017..024 landing
- **progress**: mark APP-THEME-CODEBLOCK-001..005 + regression GREEN (cluster 6)
- **progress**: mark APP-PAGES-MARKDOWN-080..086 + regression GREEN (cluster 5)
- **progress**: regenerate SPEC-PROGRESS.md after CLI-INIT-016 taxonomy refinement
- **cli**: refine CLI-INIT-016 to three-shape per-entity taxonomy
- **progress**: mark APP-PAGES-MARKDOWN-070..073 + regression GREEN (cluster 4)
- **progress**: mark APP-PAGES-MARKDOWN-060..067 + regression GREEN (cluster 3)
- **progress**: regenerate SPEC-PROGRESS.md after CLI-INIT-016 folder convention update
- **cli**: recommend dedicated config/ folder for split YAML files
- **progress**: regenerate SPEC-PROGRESS.md + FEATURES.md after CLI-INIT-016
- **cli**: document multi-file config scaling in generated CLAUDE.md
- **progress**: mark APP-PAGES-MARKDOWN-050..055 + regression GREEN (cluster 2)
- **progress**: mark APP-PAGES-MARKDOWN-040..047 + regression GREEN (cluster 1)
- **progress**: regenerate SPEC-PROGRESS.md + FEATURES.md after merging main
- **email**: document email-disabled-when-unconfigured behavior
- **progress**: re-sync SPEC-PROGRESS.md after merging main
- **progress**: refresh SPEC-PROGRESS.md, FEATURES.md, and TDD priorities
- **agent-memory**: capture pages-domain RED-spec draining patterns
- **packaging**: sync tier docs + AC statuses to shipped GREEN state
- **progress**: mark US-CLI-SERVING-STATIC-ASSETS implemented (9b7e4e734)

### Styles

- **docs**: blank line before list in runner-bug-fix entry
- **database**: collapse single-line ternary in auth-validation idType resolution
- **markdown-pages**: apply prettier auto-format to cluster 1-5 surfaces
- **cli**: apply Prettier to validate.ts source-attribution block
- **specs**: prettier-format markdown-pages cluster-3+5 scaffold specs
- **cli**: strip trailing whitespace left in admin.ts prompt helper
- prettier-format sse-streaming.md (pre-existing main drift)
- **packaging**: prettier-format gap specs

### Tests

- **theming**: regenerate visual baselines after token rename + --sv-fg fix
- **cli**: align building-static assertions with current CLI output shape
- **examples**: repoint specs at per-template subdirectory app.yaml
- **theme**: add CodeBlockConfigSchema validation tests + tag derived type @public
- **infra**: flip API-DB-PROVIDER-020 and 022 GREEN (remove .fixme)
- **infra**: add SQLite+auth+authorship RED specs (API-DB-PROVIDER-020/021/022)
- **cli**: un-fixme watch dev-experience specs (6 GREEN + regression)
- **packaging**: centralize spawnBinaryInTempDir harness + activate gap specs
- **cli**: RED specs + user story for serving static assets + SEO in server mode
- **packaging**: consolidate binary E2E into @packaging tier + docs
- **cli**: RED .fixme E2E specs for watch dev experience
- **cli**: add RED specs for dev-mode logging UX + split server-logging story

### Chores

- **agent-memory**: record latent --sv-bg cycle finding from refactor audit
- **generated**: regenerate embedded runtime assets + css assets
- **deps**: bump dependencies (knip, aws-sdk, hookform/resolvers, +others)
- **assets**: drop legacy CLAUDE.md.template and regenerate embedded manifests
- **specs**: regenerate visual baselines for v1 token refactors
- **infra**: move runner idle-stop from on-runner timer to cohab poller
- **cli**: commit regenerated coming-soon + CSS asset registries
- **server**: finalize .sovrium data-dir consolidation — tests, docs, cleanup
- **packaging**: add test:e2e:packaging convenience script
- **agent-memory**: record worktree binary-packaging workflow learnings

### CI

- **release**: pass changelog via env: to defuse backtick command substitution
- **packaging**: build host binary + run @packaging tier inline in e2e job

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
