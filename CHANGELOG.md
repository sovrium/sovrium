## [1.0.0](https://github.com/sovrium/sovrium/compare/v0.6.2...v1.0.0) (2026-05-23)

### BREAKING CHANGES

- **admin**: remove audit-log feature

### Features

- **pages/navigation**: add triggerLabel to dropdown-menu schema + island
- **progress**: add FEATURES.md migration-drift validator (Check 5)
- **pages/overlays**: dialog component-type + alert-dialog branch — APP-PAGES-DIALOG-001..005 + ALERTDIALOG-001..004 + REGRESSIONs
- **pages/display**: badge status-indicator variant — APP-PAGES-STATUSINDICATOR-001/002/REGRESSION
- **pages**: code-block component + landmine rest of layout (CONTENT-006..009)
- **pages**: activate skeleton + progress specs (OVERLAY-035..042, OVERLAY-043..049)
- **pages**: button-group + pagination components (NAVCOMP-BUTTON-GROUP-001..003, PAGINATION-001..003)
- **pages**: implement breadcrumb component (APP-PAGES-NAVCOMP-BREADCRUMB-001..003)
- **pages**: wire tooltip island hydration (APP-PAGES-TOOLTIP-001,003)
- link global stylesheet from form-page <head> + landmine markers for embedding specs
- schema diff + export admin endpoints (APP-SCHEMA-DRIFT-008..012 + REGRESSION)
- implement APP-FORMS-094,095,098 — SSR honeypot rendering + spam isolation
- X-Sovrium-Config header surfaces driftStatus (APP-SCHEMA-DRIFT-005 + REGRESSION)
- implement APP-FORMS-086 + regression — public access path + landmine markers
- **automations**: protect standard OAuth2 params from extraAuthParams/extraTokenParams override
- implement APP-FORMS-087,089,092 — form access control gate + submitter id capture
- **automations**: implement record/upsert action operator
- surface driftStatus + source in schema status (APP-SCHEMA-DRIFT-001..004,006,007)
- **pages**: wire popover island hydration + trigger/content (APP-PAGES-POPOVER-001..003)
- draft rebase endpoint (REST + MCP) — APP-DRAFT-STALENESS-008..014
- **automations**: implement record/delete action operator
- implement APP-FORMS-110,113 — embed route gating + frame-ancestors CSP
- **pages**: video embed auto-conversion, track subtitles, autoplay mapping (APP-PAGES-MEDIA-009..015)
- **automations**: HMAC-sign outgoing webhook payloads with props.secret
- implement APP-FORMS-103..108 — form availability windows, atomic submission cap, honeypot anti-spam
- expose draftStale in schema status envelope (APP-DRAFT-STALENESS-001..007)
- **automations**: expose step outputs under .result alias for chaining
- **pages**: implement list search-first display (APP-SEARCH-LIST-001..005)
- implement APP-FORMS-134,135,136,138,139 — single-page form field groups
- implement APP-FORMS-128..133 — per-form display overrides
- implement calendar + kanban component search bars
- implement APP-FORMS-146,148,149,150 — standalone form prefill resolution
- implement progress + skeleton feedback components
- implement APP-PAGES-SITEMAP-001..010 — runtime /sitemap.xml + /robots.txt
- implement APP-FORMS-140..143 — form $t: resolution against app catalog
- implement APP-BUCKETS-SIGNED-URLS-024..029 — signed URL API endpoint auth + Content-Disposition

### Bug Fixes

- **account**: complete audit_log writer + protection removal (post a76f3608c)
- **observability**: emit namespaced [<domain>] console.error on 500 paths across 12 api/routes files
- **database**: add 7 Better-Auth dialect-schema selectors + 3 aggregate-cast helpers; sweep 18+4 PG-only call sites
- **theming**: finish bg/fg → background/foreground token rename in 3 missed files
- **analytics**: wrap event properties in jsonbLiteral to restore JSONB object storage
- **observability**: namespace-log 500 paths in webhook + analytics + activity routes
- **database**: close analytics + activity-log PG-isms via dialect-aware SQL helpers
- **infra**: idle-poller now handles stopped_in_place state to release billing
- **automations**: embed TypeScript lib.d.ts in compiled binary for runTypescript validator
- **database**: route 21 repositories through dialect-aware schema resolver
- **pages**: tooltip island registry reads tooltipContent from rawProps fallback

### Refactoring

- **specs**: tighten _admin envelope assertions to .parse()
- **domain**: drop orphan custom-react component schema (Part B audit)
- **domain**: drop orphan AvatarItem + TagItem schemas (Part B audit)
- finish Task #18 share-links follow-up (remove form-embed handler)
- remove share-links runtime stack (Task #18)
- **specs**: extend codemod + ESLint rule to cover children: arrays (Task #15)
- **domain**: drop orphan avatar-group + tags specialty component schemas (Task #16a)
- **specs**: drop 7 unused fixture helpers flagged by knip
- **specs**: tighten notifications/inbox sender shape assertion
- Phase C — defer post-MVP items to docs/POST-MVP.md index
- Phase B.2 — YAGNI bulk delete (custom-react + interactivity orphans + social + forms/embedding)
- Phase B.1a — delete pre-validated landmines (display + 5 nav menus + rate-limiting)
- **specs**: use 'text' component type instead of 'single-line-text' field-type literal
- **pages**: extract pagination-entry + harden scroll-area island registry
- **automations**: extract OAuth2 reserved-params helper to sibling module

### Documentation

- **schema**: refresh stale audit_log references in comments + fixtures
- **progress**: refresh FEATURES.md spec counts post audit-log test removal
- **progress**: refresh SPEC-PROGRESS + user stories post audit-log removal
- **progress**: add YAML examples for pages.components.steps + layout.header.components
- **progress**: remove 18 orphan FEATURES.md rows (post-MVP deletions)
- **progress**: align safety + data-timeline single-US files with spec paths
- **progress**: remove 14 deferred US sections (post-MVP cleanup)
- **progress**: re-refresh dashboards after rebase onto share-links-removed main
- **progress**: remove APP-FORMS-012 AC row (embed route removed Task #18)
- **progress**: refresh dashboards + customer-roadmap after deferred-batch landing
- **progress**: clear progress error + 9 FEATURES.md / README orphans
- **progress**: drop NotificationBellSchema + SendNotificationActionSchema from coming-soon
- **progress**: regenerate coming-soon registry after Phase B.2 (Comments schemas dropped)
- **progress**: refresh dashboards after rebase onto Wave-2a clusters 1-2
- **development**: document typescript-bump step in dependency-bump-checklist
- **progress**: refresh SPEC-PROGRESS.md + FEATURES.md after Wave 2a clusters 1-2 (Badge + Dialog)
- **progress**: refresh SPEC-PROGRESS.md + FEATURES.md + user-stories after Wave 1 drain integration
- **pages/display**: landmine all 13 display specs
- **pages/overlays**: landmine 4 overlay specs blocked on schema/runtime gaps
- **pages/navigation**: landmine 5 nav specs needing Base UI islands + schema alignment
- **specs**: landmine APP-FORMS-118..127 + analytics regression

### Styles

- **specs**: prettier-reformat coming-soon-flagging test.step calls
- **format**: apply Prettier auto-format to 4 pre-existing line-wrap drifts
- **scripts**: apply Prettier auto-format to check-runner-config-drift.ts
- apply Prettier single-line reformat to applyExtraParamsExcludingReserved call
- fix prettier drift in sse-streaming doc + ai-chat-component

### Tests

- **account**: drop audit-log-trail assertions from account-deletion spec
- **theming**: gate timeline-island style reads on data-island-ready signal
- **auto-save**: raise debounce wait to 1500ms in data-table-auto-save
- **specs**: drop audit-log-dependent @spec tests + test.steps
- **automations**: scope 60s timeout override to local-only (CI uses 180s)
- **cli**: skip leaf-schema warning steps when COMING_SOON_LEAF_SCHEMA_TAGS is empty
- **forms**: remove orphan embed-route test.step after Task #18 handler removal
- **coming-soon**: skip leaf-schema detection tests when registry has no example
- **internal-tables**: drop share_links references after runtime removal
- **theming**: regenerate darwin baseline for destructive confirm button
- **theming**: drop invalid badge variant='alert' from color-tokens spec config
- **automations**: raise code.spec.ts regression timeout to 60s
- **automations**: re-LANDMINE APP-AUTOMATION-SAFETY-RATE-001 — missing runs-API aggregation endpoint
- silence tsc — `as const` on schema literal + double cast on row shape
- **landmine**: annotate 12 schema-retention fixmes with implementation gap
- **landmine**: document 9 MCP schema-tool fixmes with implementation pointers
- **landmine**: mark APP-VERSION-HISTORY-005/006 with corrected fixture pattern
- **automations**: document batch-operations landmine (schema + dispatch + data shape)
- **automations**: document client-credentials grant landmine
- **automations**: activate STATE-DELETE/LIST/SET-002, landmine 4 JSONB-encoding ambiguities
- activate APP-VERSION-HISTORY-013 + fix executeQuery shape assertion
- activate APP-SCHEMA-DRIFT-013..017 + REGRESSION (reload/restart drift gate)
- **buckets**: mark APP-BUCKETS-SIGNED-URLS-ATTACH-REGRESSION as LANDMINE — dependency on missing attachment enrichment infra
- **automations**: activate AUTH-002, mark AUTH-001/REGRESSION landmines
- **automations**: mark runs-api RUNS-004/007/011 as landmines
- activate MCP schema-tools rebase/stale/source specs (020,022,023)
- **automations**: activate connection-configuration regression specs
- **pages**: activate image component specs (APP-PAGES-MEDIA-001..008)
- implement APP-VERSION-HISTORY remote-URL ledger specs (010-012)
- **pages**: activate iframe embed specs (APP-PAGES-MEDIA-020,021,023,024 + regression)
- **automations**: activate APP-AUTOMATION-SAFETY-RATE-001
- **pages**: activate audio component specs (APP-PAGES-MEDIA-016..019)
- **automations**: mark APP-AUTOMATION-DEFINITION-014 as landmine
- implement APP-VERSION-HISTORY ledger-contract specs (001-004,007-009,REGRESSION)
- mark APP-BUCKETS-SIGNED-URLS-030..034 as LANDMINE — attachment signed-URL enrichment missing
- implement APP-BUCKETS-SIGNED-URLS-035..040 + RBAC regression — role-based signed URL access
- activate APP-SEARCH-ENGINE-001..004 — search engine selection
- activate APP-SEARCH-HIGHLIGHT-002..004 — inline component search highlight
- activate APP-SEARCH-WEIGHT-001..003 — field search weights
- implement APP-SCHEMA-VERSIONS-009..012 — DEC-023 source provenance on version rows
- implement APP-PAGES-TWITTER-APP-001..004 — Twitter app card meta tags

### Chores

- **db**: generate 0003 migrations for audit_log table removal
- **admin**: delete unused admin-rbac + list-endpoint helpers post audit-log
- **admin**: drop unused opUserId + prettier-fix list-endpoint
- **db**: generate 0002 migrations for share_links table removal
- **quality**: add embedded-TypeScript-lib version-drift sentinel to bun run quality
- **css**: refresh BUILTIN_CSS_CANDIDATES scanner output
- **quality**: clear Tier-1 ESLint blockers — complete text-components rename, drop tooltip complexity, numeric separator
- **infra**: add opt-in --probe-live to runner config drift checker

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
- **dev**: GET /\_\_sovrium_dev/reload SSE endpoint
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
- **user-stories**: move CLI-INIT-AGENT-COPY-\* into sibling init-agent-copy.md
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
