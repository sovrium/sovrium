## [0.11.0](https://github.com/sovrium/sovrium/compare/v0.10.0...v0.11.0) (2026-06-17)

### Features

- **website**: extend hero accent (warm wash + accent eyebrow) to all landing pages
- **website**: ambitious hero redesign + sitewide customer trust band
- **website**: add competitor-comparison SEO library (/compare, 31 pages)
- **website**: real customer logos, shared trust band, Partner navbar CTA
- RAG Phase 2 — opt-in sqlite-vec ANN + FTS5 hybrid retrieval (DEC-029)
- **automations**: drain approval-register roundtrip specs to GREEN
- **pages**: alert-dialog confirm dispatches its configured automation action (DEC-037)
- **automations**: approval action pauses run, resolves via run-scoped approve/reject (DEC-037)
- record-context submit fields for schema-config editors
- hydrate reverse one-to-many collections in record-trigger envelope (GAP-J2)
- docs-article breadcrumb + "View as Markdown" header
- **docs**: navbar/search overhaul + palette opt-out + collapsed sidebar
- implement tail-logs host effect for host log drain
- icon variant for theme-toggle component
- TOC scroll-spy + prose spacing fixes for docs markdown
- collapsible docs sidebar via contentDir.nav.collapsed
- content-body search with highlighted excerpts in command palette
- add commandPalette opt-out to AppSchema
- **cloud**: host metrics sampling hook populates app metrics for running apps (B2, DEC-034)
- **pages,forms,automations**: KPI SSR label, $record prefill, relationship hydration, validate-config (Clusters I+J)
- **cloud**: usage rollup + monthly invoicing live; activate usage/invoicing specs (16/17, Batch 5)
- **apps/docs**: adopt groupLabels, JSON-LD synthesis, generated llms.txt, theme toggle with light mode
- **theming**: theme-toggle component, theme.colorScheme, no-FOUC color-scheme head script
- **seo**: auto-generate /llms.txt and /llms-full.txt from contentDir pages
- **seo**: auto-synthesize TechArticle + BreadcrumbList JSON-LD for contentDir pages
- **pages**: contentDir nav groupLabels + humanize, skip link, code-copy button
- **automations,tables**: comment-thread email recipients + composite row-level predicates (Cluster E)
- **pages**: read-only record-field display + dialog mounts closed (platform gap Cluster D)
- **islands**: structured-form & AI-agent schema-config editors (platform gap B10)
- **automations**: host env-var injection with secret resolution (platform gap B9)
- **cloud**: host log drain into app_logs (platform gap B8)
- **automations**: per-app resource-quota registry (platform gap B5)
- **automations**: reverse-proxy ingress + custom-domain TLS (platform gap B4)
- **automations**: multi-version process supervisor registry (platform gap B2)
- **automations**: per-tenant database provisioning registry (platform gap B3)
- **automations**: cloud orchestration action handler (platform gap B1)
- **islands**: JSON & YAML schema-config editors (platform gap B10)
- **apps**: move partner marketing to the website; make partner a portal-only app
- **apps/website**: rebuild marketing site on the default design system
- **auth**: role-aware login landing (onSuccess role-landing)
- **forms**: configurable/localizable CRUD labels + dialog formRef

### Bug Fixes

- **website**: resolve broken comparison-library links to locale-aware hrefs
- resolve ESLint issues from the docs UX-fix campaign
- do not force inline display:inline-block on image elements
- **css**: apply precompiled-file gate in production CSS branch
- **forms,partner**: visibility-gated formRefs don't 404 the page — resolve FORMS-017
- **automations**: hydrated record fields stringify as their FK id
- **cloud**: final re-flip — 139/152 cloud specs green (13 residual fixme)
- **pages,forms**: automation/logout buttons + embedded-form runtime (Cluster H)
- **auth**: respect display:none hide-gate on full-width auth-form wrapper
- **cloud**: activate signup + public-surface specs (16/24, Batch 1)
- **seo**: recognize hardcoded-language page paths in sitemap and hreflang alternates
- **partner**: final re-flip — all automations + billing green (1 fixme left)
- **automations**: hydrate USER fields in record-event trigger envelope (Cluster G2 / GAP-20)
- **seo**: synthesize canonical, hreflang alternates, and Open Graph meta for contentDir pages
- **seo**: expand contentDir pages in sitemap + index them in command-search
- **automations**: http JSON response body + comment owner-fallback custom created-by (Cluster G1)
- **pages**: 301-redirect bare /:lang and return real 404 for unknown contentDir slugs
- **records,forms**: records-API custom created-by + form-create fires record automations (Cluster F)
- **records**: narrow readonly write-reject to truly-computed types (Cluster B follow-up)
- **automations,tables**: filter OR logic + cron run-now + formula int-division CAST (Cluster C)
- **automations,records**: connection $env. resolution + overridable field defaults (Cluster B)
- **records**: authorship for automation + form record writes (platform gap Cluster A)
- **partner**: activate Plans + Billing specs (10/26; billing blocked on platform gaps)
- **partner**: activate Forms + Onboarding specs + fix dropped onboarding forms (23/27)
- **partner**: activate Engineer specs + fix empty client-identity card (13/15)
- **security**: SSRF-guard file:upload action source resolution (Finding #8)
- **tables**: single-record GET row-level read 404'd users on their own id-scoped record
- **partner**: activate Portal E2E specs + unblock customer projet access
- remediate 7 security findings (AI-SQL, SVG XSS, NODE_ENV coupling, fail-closed, committed secrets)
- restore Partner app boot + branded accept-invitation page
- **db**: emit ISO-8601 timestamps for SQLite auto-timestamp defaults
- resolve raw $t: tokens in Twitter card meta tags
- **ui**: correct docs markdown layout and polish the docs site
- **auth**: render auth form full-width to match design-system auth layout
- **docs**: correct markdown locale, empty article body, and frontmatter meta
- **auth**: treat the highest-level role as admin-equivalent
- **css**: honor string-valued flex/grid layout props
- exclude non-FK relationship edges from table-creation dependency sort
- compute view-only-referencing formulas in the VIEW (rollup/lookup/count)
- resolve relationship FK column type from referenced table's primary key

### Refactoring

- **website**: drop unused table tokens from styles.ts
- document RAG Phase 2 scaling posture + setCustomSQLite ordering caveat
- **automations**: document the approval-resolution capability-token threat model
- correct editor lockPrefill enforcement doc to match actual guarantee
- rename commandPalette AppSchema property to palette
- use destructuring for id access in resolve-trigger-data
- persist-safe GAP-J2 reverse collection (drop hybrid array)
- **repositories**: mirror entity-domain subdirectories across ports and live implementations
- **domain**: group services and utils into semantic subdirectories
- **domain**: group env models into semantic subdirectories
- **islands**: group ~89 top-level island files into feature subdirectories
- **presentation,automations**: dedup campaign-era substitution, hydration, and client handlers
- **security**: remove dead latent-SSRF baseUrl prop from AI actions (#9)
- **cloud**: replace B8 boot-seed with a live stdout/stderr log drain
- **server**: derive authConfig from app in invitation routes
- **ui**: style docs markdown with @tailwindcss/typography prose
- type business-app configs as AppConfig, drop unsafe casts
- drop custom theming from business apps for native design system
- business-app E2E specs boot the real apps/ configs
- **progress**: retire the "TDD Automation" report section
- **progress**: relocate FEATURES.md/priority utils out of tdd-automation

### Documentation

- **patterns**: document the bare /{lang} + meta.lang i18n anti-pattern
- **progress**: regenerate after fixme-drain campaign — 0 remaining specs
- **specs**: fix stale sqlite-vec-search path in phase-2 spec banner
- **progress**: regenerate after fixme-drain waves 5-6 merge
- require contributor certification for code submissions
- **progress**: regenerate after docs UX-fix campaign merge
- **agent-memory**: record docs UX-fix campaign platform fixes & gotchas
- **progress**: regenerate SPEC-PROGRESS after docs UX-fix campaign
- **us**: align GAP-J2 semantics with persist-safe first-row hydration
- **docs-app**: license/trademark/contributing pages + footer rebuild
- **progress**: regenerate after SPEC-WARNINGS cleanup — 0 errors, 0 warnings
- resolve SPEC-WARNINGS content-quality issues (orphan, US flips, YAML, README)
- **progress**: regenerate progress tracking after Cloud platform-gap campaign
- **git-infra**: correct runner archived-state facts after live verification
- **git-infra**: align runbooks, ADRs, and scripts with post-de-Coolify live state
- fix stale content across infrastructure docs, CLAUDE.md, and docs index
- **apps/docs**: fix llms.txt links+counts, document missing CLI commands, add templates-examples + runtime-customization articles, a11y fixes
- **specs**: reconcile user-story AC markers; fix partner billing env drift
- **spec-progress**: regenerate progress report and reconcile US markers
- **spec-progress**: regenerate after sqlite-timestamp fix merge
- **spec-progress**: regenerate after website-redesign merge
- **spec-progress**: regenerate dashboard after partner/website consolidation
- **apps/docs**: correct French intro content so /fr/ docs render green
- **user-stories**: reconcile AC status markers + add RAG phase-2 spec
- **apps/docs**: French documentation content
- **progress**: add YAML coverage for action fields[] override (0 warnings)
- **spec-progress**: regenerate dashboard after website rebuild merge
- **apps/docs**: comprehensive feature reference (EN + FR)
- **progress**: reflow auth FEATURES + role-landing US tables (regenerated)
- reflow tables US markdown tables; regenerate SPEC-PROGRESS
- reflow git-infra markdown tables (prettier alignment)
- split user-stories + progress report by Sovrium binary vs business apps
- de-Coolify host/harden.sh framing + refresh scaleway-infra-maintainer memory for git-infra layout
- consolidate forgejo/ + sovrium-git/ into unified git-infra/ (host + runner + archive)
- archive pre-de-Coolify cohab runbooks + fix inverted forgejo/sovrium-git framing
- retire dead Traefik proxy configs + reframe response-headers backstop to Caddy
- align doc-tree with executed de-Coolify (Coolify/Traefik retired)
- refresh SPEC-PROGRESS.md timestamp after partner spec import
- normalize partner US acceptance-criteria status to specified marker
- add Sovrium Partner business-app user stories
- remove TDD Automation Pipeline section from CLAUDE.md
- refresh SPEC-PROGRESS.md timestamp after business-app spec import
- repoint internal coolify path links to sovrium-git (de-Coolify W1 follow-up)
- add Sovrium Docs business-app user stories
- reinstate Forgejo ADR-005 (Caddy) and archive Coolify ADRs (de-Coolify W1)
- de-Coolify CLAUDE.md topology and remove Coolify MCP server (de-Coolify W1)
- add Sovrium Website business-app user stories
- add Caddy ingress config for dedicated Forgejo host (de-Coolify W1)
- add Sovrium Cloud business-app user stories
- split Sovrium Cloud plan into de-Coolify + apps/cloud plans
- drop public `sovrium cloud` CLI from Cloud design plan
- add Sovrium Cloud migration & design plan (draft, not executed)

### Styles

- **assets**: realign logo README markdown tables
- **apps**: propagate element-cell logo to business apps' brand assets
- **assets**: evolve logo into periodic-table element cell + JPG kit
- **us**: realign markdown tables after palette rename
- fix import order in app schema index after palette merge
- apply Prettier formatting to docs UX-fix campaign files
- destructure id in resolve-trigger-data to satisfy prefer-destructuring
- **apps/partner**: prettier line-join in enrich-client-from-siret automation
- prettier table realignment on US and docs content files
- **specs**: apply prettier formatting to partner rollups spec
- **apps**: prettier-format brand-lockup US + specs
- **apps**: unify header brand lockup "[Sovrium mark] Sovrium <AppName>"
- **cloud**: prettier-format merged Cloud PaaS specs + US
- **user-stories**: prettier-format partner/website business-app markdown
- reflow crud-form override ternary (prettier)
- **apps/partner**: reflow long className strings (prettier)
- **apps/website**: clean-UI redesign — real className styling + SVG icons
- **apps/docs**: drop emoji badge + tokenize mobile-menu background
- **apps/partner**: clean-UI redesign on native design system
- **forms**: extend the shared field-spacing default to auth forms
- **forms**: unify default field spacing across embedded and standalone forms
- format partner config and specs to the monorepo Prettier style
- clear pre-existing lint in progress/validate business-app validators
- re-pad markdown table after TDD archive-path repoint
- prettier-format de-Coolify doc edits (de-Coolify W1)
- apply Prettier to Sovrium Cloud plan docs
- wrap long call in validateAppConfig to satisfy Prettier

### Tests

- **fixtures**: restrict timeout-retry and 10s attempt bound to GETs only
- **fixtures**: respawn AI mock on unexpected clean exit too
- **e2e**: harden AI mock resilience and fix flaky specs from run 6222
- **website**: split comparison specs one-per-user-story with AC tables
- **website**: E2E specs + user stories for the comparison library
- **specs**: isolate per-step port + lock dir in server-management regression
- **fixtures**: stop ai-mock-server respawn log spam on graceful exit
- **specs**: fix skip-link selectors, /fr locale-prefix, dev-port isolation, cloud poll budgets
- **cloud**: drain last 5 cloud fixmes — destroy-confirm + orchestration
- **automations**: amend approval-register roundtrip to Wave-6 pause-resume + reset-password token
- author approval pause/resume + alert-dialog confirm-action platform contracts (DEC-037)
- **editors**: specify record-context submit fields for config editors (US-005)
- **pages**: platform US + spec for commandPalette opt-out
- **docs**: app specs + US for navbar CTAs, collapsed sidebar, search & legal pages
- scope nav-group-label assertions to the sidebar
- add reverse one-to-many relationship hydration coverage (GAP-J2)
- **cloud**: add literal settled-value assertions after expect.poll (validator)
- add tail-logs host-effect spec coverage to host log drain
- **website**: fix bootWithAdmin call-site typing (drop excess signIn fixture)
- **infra**: specify host metrics sampling hook (B2 residual, DEC-034)
- drain website auth fixmes via admin-bootstrap fixture
- **cloud**: add literal settled-value assertions after expect.poll waits
- add literal expect assertions to expect.poll-only specs + regression steps
- **cloud**: activate orchestration + ops specs (14/30, Batch 4)
- **cloud**: activate app-cockpit tab specs (resources/env/params/activities-logs/metrics/configuration)
- **cloud**: activate app-resources specs with bound resources form
- **e2e**: harden AI mock lifecycle and accept SSRF-guard error message
- **cloud**: activate console-core specs (35/39, Batch 2)
- **partner**: open the Nouveau client dialog via its trigger (Cluster D contract)
- **partner**: drop unused PARTNER_TEST_ENV consts (fix TS6133)
- **docs-quality**: add US + RED specs for contentDir fixes, llms.txt, JSON-LD synthesis, theme toggle
- **partner**: re-flip automations after platform fixes (+14 green)
- **partner**: re-flip billing + remaining lighter specs after Cluster F (+9 green)
- **partner**: re-flip lighter areas after platform fixes (+13 green)
- **partner**: activate Automations specs (7/24; HMAC fixed spec-side)
- **partner**: activate Projets + Demandes specs (15/20)
- **partner**: activate Auth/RBAC E2E specs (7 files, 25 tests)
- **security**: file:upload SSRF spec + user story (finding #8)
- **apps/partner**: mark brand-lockup specs fixme — blocked by partner boot bug
- **forms**: match form-layout assertion to the load-bearing w-full token
- spec Cloud PaaS platform gaps + day-2 orchestration ops (US + red specs)
- **apps/cloud**: spec full Cloud PaaS UX — user stories + red E2E specs
- **design-system**: refresh crud-form baseline for default field spacing
- give each @spec ID its own test.step in partner regression tests
- add Sovrium Partner automations E2E specs
- add Sovrium Partner forms E2E specs
- add Sovrium Partner engineer-admin E2E specs
- add Sovrium Partner demande-detail E2E specs
- add Sovrium Partner projet-detail E2E specs
- add Sovrium Partner portal E2E specs
- add Sovrium Partner auth & RBAC E2E specs
- add E2E specs + regressions for Sovrium Docs (apps/docs)
- add E2E specs + regressions for Sovrium Website (apps/website)
- add @regression tests for Sovrium Cloud signup specs
- add E2E specs for Sovrium Cloud signup (apps/cloud)
- isolate server.test.ts DB to a temp SQLite file

### Chores

- **agents**: add per-surface design references and design-system stewardship to app-design-finalizer
- **agent-memory**: record runner protection-flag billing incident
- **agents**: add app-design-finalizer agent with copywriting and SEO expertise
- **assets**: regenerate embedded runtime and CSS candidate assets
- record trigger-data replay round-trip constraint in auditor memory
- **assets**: regenerate embedded runtime and CSS candidate assets
- **quality**: baseline grpc-js advisories + format logo README
- **specs**: remove dead provisionTenantOwner helper (knip gate)
- **agents**: record codebase-refactor-auditor memory from deep-audit run
- record progress --strict suggestion-blocking + validator false-positive notes in agent memory
- **specs**: remove dead provisionTenantOwner helper from cloud spec helpers
- regenerate SPEC-PROGRESS.md post-merge
- regenerate SPEC-PROGRESS.md
- regen css assets for dark-variant utilities + agent memory notes
- **agents**: update codebase-refactor-auditor memory (automation env-secret persistence)
- remove dead files and archive completed docs
- **agents**: fix stale paths, isolation regression, and runner-lifecycle facts in agent configs
- **test**: drop redundant functional/no-let disables in file-support SSRF test
- **memory**: persist security-remediation agent learnings
- **types**: resolve @sovrium/types via tsconfig paths to source
- **agent-memory**: record business-app chrome/brand spec gotchas
- **website**: redesign marketing site — pricing, IA, SEO, demo visuals
- **apps**: add Sovrium "element" logo + wire favicons into business-app heads
- **apps/partner**: subscription Plans + Stripe/Pennylane billing US & specs
- **agent-memory**: record prose-typography markdown pipeline learning
- **css**: wire @tailwindcss/typography into the compiler; fix stale docs version
- **quality**: clear bun quality errors + warnings
- schema editor models, website user stories, decisions, misc
- **apps/cloud**: cloud app expansion (config, user stories, specs)
- **apps**: co-locate each app preview's .sovrium data dir under apps/<app>/
- **apps**: consolidate dev-preview env into a single committed .env.dev per app
- **apps**: remove brand-charter page; bootstrap-seed cloud login spec
- **apps/cloud**: native console login page + home/onboarding clean-UI polish
- **auth**: native-styled, localizable embedded auth forms + AUTH_ADMIN_ROLE
- **apps**: drive app:* previews from per-app .env (auth secret, bootstrap admin, cloud mode)
- update FEATURES.md and regenerate feature-priorities
- register relationship FK sibling specs in progress US-spec mapping
- regenerate feature-priorities after FEATURES.md binary/business-apps split
- repoint product-specs-architect refs off deleted sovrium-cloud plan
- **mirror**: generate curated public package.json for GitHub mirror
- scaffold apps/cloud control console + cloud action schema shape
- **dev**: add app:<name> live-preview scripts for MCP-driven spec authoring
- **docs,agents**: fix stale references, versions, and removed-package docs
- regenerate SPEC-PROGRESS.md after merging main
- align business-app specs to canonical specs/apps/ + fix partner spec types
- **agent-memory**: update agent-maintainer roster for de-Coolified scaleway scope
- **agents**: remove Coolify references (de-Coolify effort)
- **agents**: fix infra-architect pipeline-step count + e2e-test-fixer opener
- **agents**: correct scaleway runner topology + past-tense rename notes
- **agents**: register sovrium-design skill + soften gerund naming rule
- **memory**: record sovrium-website full decommission
- import sovrium-partner business app config
- tidy stragglers after TDD-pipeline decommission
- tag exports orphaned by TDD-pipeline archival as @public
- drop generated build output from apps/docs/public, normalize imported content
- exclude apps/** from src-layer lint and apps/*/public from prettier
- **agents**: delete tdd-pipeline-maintainer and strip TDD-pipeline references
- archive TDD automation pipeline (docs, scripts, workflows)
- de-Coolify .forgejo cleanup comments, legal docs, and security paths (de-Coolify W1)
- import sovrium-docs business app config (apps/docs)
- exclude docs/archive from tooling globs
- de-Coolify provisioning scripts to Forgejo + Caddy host (de-Coolify W1)
- rename coolify dir to sovrium-git and repoint drift-check (de-Coolify W1)
- import sovrium-website business app config (apps/website)
- import sovrium-cloud business app config (apps/cloud)
- **memory**: record Sovrium Cloud orchestration action design consultation
- extend product-specs-architect to own Sovrium business-app specs
- extend progress/quality validators to cover business-app content
- record server.test.ts DB-isolation lesson in agent memory

### CI

- collapse test.yml to linear lint → typecheck+unit → e2e

## [0.10.0](https://github.com/sovrium/sovrium/compare/v0.9.0...v0.10.0) (2026-06-02)

### Features

- AI-compute async refinement via real provider on both engines
- AI-compute deterministic baseline on both engines + two-phase scaffolding
- RAG works on SQLite via BLOB embeddings + app-side cosine
- **comments**: filter non-admin comment list to approved-only (APP-PAGES-PUBLIC-COMMENTS-019)
- **comments**: persist resolved moderation status on create (APP-PAGES-PUBLIC-COMMENTS-027)
- **comments**: surface guest name in comment thread (APP-PAGES-PUBLIC-COMMENTS-006)
- **comments**: persist guest identity on comment create (APP-PAGES-PUBLIC-COMMENTS-005)

### Bug Fixes

- map numeric precision to SQL scale, not total digits (#15)
- defer FK enforcement during SQLite schema-migration transaction
- align SQLite field-value serialization with Postgres (DEC-027)
- emit ISO-8601 timestamps from SQLite updated_at trigger
- **types**: export DeleteViewTarget so @sovrium/types .d.ts emit succeeds
- harden email validation and HTML-tag regexes flagged by CodeQL
- **css**: compile per-app CSS under ECO_DESIGN_LAYER=off (light parity)
- **css**: serve per-app CSS when app adds candidates beyond builtin
- **comments**: persist pending/rejected comments so admin queue lists them (APP-PAGES-PUBLIC-COMMENTS-020)

### Refactoring

- move agent-approval DB mirror behind ApprovalRepository
- move account export/erasure data-access behind AccountRepository
- move chat tool-calling raw query behind DynamicRecordRepository
- move admin forms data-access behind AdminFormsRepository
- move admin automations data-access behind AdminAutomationsRepository
- remove the coming-soon flagging system
- move admin users-overview data-access behind UsersOverviewRepository
- move command-search data-access behind CommandSearchRepository
- move favorites/recent data-access behind UserEntityListRepository
- **comments**: consolidate guest-session helpers + close guestEmail leak
- **rendering**: extract type-specific prop dispatch from component-renderer

### Documentation

- add docs-site example using the markdown pages feature
- Phase 2 design — real-AI compute, two-phase baseline-then-refined
- record AI-on-SQLite design (DEC-029/030) as first-class direction
- **examples**: turn blog into a CMS with admin space + AI editor agent
- **examples**: rebuild crud-app as an Airtable-style workspace with an AI agent
- update migration tree listing for squashed baseline
- polish README for v0.10.0 (correctness, tone, AI-first entry point)
- reformat ADR-018 and realign ADR index Status column
- scrub private infra data from README, mirror .env.example
- add ADR-018 superseding ADR-006 (table permissions as schema config)
- update status framing to reflect feature-complete MVP
- mark all FEATURES.md rows as Covered
- **better-auth**: point vendored-source section at the re-pulled v1.6.13 snapshot
- **progress**: mirror moderation regression GREEN — 0 fixme remaining
- **progress**: mirror APP-PAGES-PUBLIC-COMMENTS-026 GREEN
- **progress**: mirror APP-PAGES-PUBLIC-COMMENTS-022 GREEN
- **progress**: mirror APP-PAGES-PUBLIC-COMMENTS-021 GREEN
- **progress**: mirror APP-PAGES-PUBLIC-COMMENTS-020 GREEN
- **progress**: mirror APP-PAGES-PUBLIC-COMMENTS-019 GREEN
- **progress**: mirror APP-PAGES-PUBLIC-COMMENTS-023 GREEN
- **progress**: mirror APP-PAGES-PUBLIC-COMMENTS-027 GREEN
- **progress**: mirror guest-comments regression GREEN
- **progress**: mirror APP-PAGES-PUBLIC-COMMENTS-006 GREEN
- **progress**: mirror APP-PAGES-PUBLIC-COMMENTS-005 GREEN
- **progress**: regenerate reports to reflect 11 RED public-comments specs

### Styles

- prettier-format theming-architecture.md DEC-026 table
- **comments**: prettier-format moderation-queue spec

### Tests

- align example specs with reworked crud-app (OKLCH theme + pages)
- add anti-drift check for SQLite dual-dialect coverage doc
- add getColumnInfo helper + parameterize 15 field-type specs cross-dialect
- add selective SQLite parity probes for pages + account
- add SQLite parity probe for buckets local-storage round-trip
- add SQLite parity probe for AI chat/agent persistence
- add SQLite parity probes for DB-touching automation actions
- add SQLite parity probes for api/ health + schema-management
- **pages**: await table row visibility after reload (APP-RUNTIME-VIEWS-028)
- **design-system**: set global screenshot jitter tolerance; drop per-spec nav override
- **design-system**: tolerate parallel-load jitter on 2 nav snapshots
- **design-system**: re-scope layer-off contract to light-only parity (DEC-026)
- **design-system**: regenerate darwin baselines after CSS fast-path fix
- **design-system**: regenerate calendar + date-picker darwin baselines post dep-sync
- **comments**: enable moderation regression (APP-PAGES-PUBLIC-COMMENTS-MODERATION-REGRESSION)
- **comments**: enable approved-only count spec (APP-PAGES-PUBLIC-COMMENTS-026)
- **comments**: enable admin-reject spec (APP-PAGES-PUBLIC-COMMENTS-022)
- **comments**: enable admin-approve spec (APP-PAGES-PUBLIC-COMMENTS-021)
- **comments**: enable autoApprove.authenticated spec (APP-PAGES-PUBLIC-COMMENTS-023)
- **comments**: enable guest comments regression (APP-PAGES-PUBLIC-COMMENTS-GUEST-REGRESSION)
- **design-system**: regenerate darwin baseline for zero-config menubar menu
- **pages**: poll row height in VIEWS-031 to await server density sync
- **pages**: click empty calendar cell in CALENDAR-012 to avoid event overlap
- **specs**: assign canonical spec IDs to comment purge + email-privacy tests

### Chores

- fix quality gate failures (max-lines, css scan test pollution)
- squash drizzle migrations to one baseline per dialect
- agent memory + coverage-doc formatting
- regenerate embedded runtime + css assets to match source
- auto-approve project MCP servers via enableAllProjectMcpServers
- add Playwright MCP server (bunx launcher)
- squash drizzle migrations into a single clean baseline
- **agent-memory**: record cohab Forgejo 503 deadlock pattern + recovery
- **agent-memory**: record ECO_DESIGN_LAYER=off dark-mode gap (DEC-026)
- **agent-memory**: record CSS precompiled-file candidate-gap finding
- regenerate SPEC-PROGRESS.md from merged tree
- regenerate embedded assets and format docs after dependency sync
- **deps**: update dependencies and sync version references in docs
- **ci**: re-trigger CI to mirror stranded v0.9.0 release tag

### CI

- auto-discover all screenshot specs in update-snapshots workflow

## [0.9.0](https://github.com/sovrium/sovrium/compare/v0.8.1...v0.9.0) (2026-05-31)

Release 0.9.0

## [0.8.1](https://github.com/sovrium/sovrium/compare/v0.8.0...v0.8.1) (2026-05-25)

### Bug Fixes

- **database**: MIGRATION-CHECKSUM-VIEW-DRIFT-001 — preserve auto-generated lookup views across boots

### Documentation

- **progress**: refresh SPEC-PROGRESS.md — MIGRATION-CHECKSUM-VIEW-DRIFT-001 GREEN (d3a33544d)

## [0.8.0](https://github.com/sovrium/sovrium/compare/v0.7.2...v0.8.0) (2026-05-25)

### Features

- **database**: emit SQLite INSTEAD OF triggers for view-backed tables
- **database**: align SQLite dynamic-table default id to INTEGER (ADR-016)
- **pages-social**: add comments + commentCount page components (SSR scaffolding tier)
- **admin-automations**: drain runs-list.spec.ts (12 fixmes → GREEN)
- **admin-automations**: drain overview.spec.ts (8 fixmes → GREEN)
- **data-components**: drain record-detail-page-pattern — APP-PAGES-RECORD-DETAIL-001/003
- **data-components**: drain runtime-sort-configuration — APP-RUNTIME-VIEWS-008 + a11y polish
- **data-components**: drain runtime-column-visibility — APP-RUNTIME-VIEWS-012/014/015
- **data-components**: drain record-navigation — APP-PAGES-RECORD-DETAIL-017..020
- **data-components**: drain related-records-display — APP-PAGES-RECORD-DETAIL-013..016
- **data-components**: drain record-header-breadcrumb — APP-PAGES-RECORD-DETAIL-006..008
- **data-components**: drain form-reset-after-success — APP-PAGES-FORM-062
- **pages-layout**: drain tab-container — rewrite fixtures against TabPanelContent + id-based defaultTab schema
- **pages-layout**: drain divider-spacer specs — divider + spacer renderer bodies
- **pages-layout**: drain divider-spacer — add divider + spacer renderers (HR with style/label, sized div spacer); rename structural-components.ts to .tsx for JSX
- **pages-layout**: drain accordion-toggle — rewrite fixtures against buildAccordionItems contract (props.id + content.title/body)
- **pages-layout**: drain callout-alert — use type:alert + variant prop (dismissible AC deferred)
- **pages-layout**: drain tab-behavior — rewrite tabs fixtures against TabPanelContent schema
- **pages-layout**: drain basic-app-shell + app-shell-sidebar — honor navigation-menu className for vertical layout
- **pages-layout**: drain sidebar-navigation-items + blockquote — add renderBlockquote + use aside-element for sidebar
- **admin-forms**: drain admin/forms — list/detail + submissions list/detail/bulk
- **ecoconception**: drain low-data-mode — operator-controlled render variant
- **ecoconception**: drain dashboard-overview — GET /api/admin/eco/overview
- **admin-buckets**: drain ADMIN-BUCKETS-LIST + OVERVIEW (16 of 17 GREEN)
- **form-controls**: drain field-composed-form-field specs
- **form-controls**: drain date-picker specs
- **form-controls**: drain slider + switch + checkbox + radio-group specs
- **form-controls**: drain combobox specs
- **form-controls**: drain time-picker + number-input specs
- **form-controls**: drain dropzone-file-upload + label specs
- **cli**: drain CLI-COMMANDS-VALIDATE-001..007 + REGRESSION
- **cli**: drain CLI-COMMANDS-BUILD-001..007 + REGRESSION
- **cli**: drain CLI-COMMANDS-SCHEMA-001..006 + REGRESSION
- **cli**: drain CLI-COMMANDS-AGENTS-001..006 + REGRESSION
- **cli**: drain CLI-COMMANDS-INIT-001..006 + REGRESSION
- **cli**: drain CLI-COMMANDS-START-001..005 + REGRESSION
- **cli**: drain CLI-COMMANDS-HELP-001..005 + REGRESSION
- **cli**: drain CLI-COMMANDS-VERSION-001..004 + REGRESSION
- **admin**: drain ADMIN-CONFIG-VERSION + ADMIN-TABLES-OVERVIEW
- **forms**: drain APP-FORMS-100 — captcha schema acceptance
- **forms**: drain APP-FORMS-088/090/091/093 — partner role, defaultValue, formRef gates
- **forms**: drain APP-FORMS-109 — availability.closedPage schema
- **pages-overlays**: add hover-card island + drain OVERLAY-029..034 + REGRESSION
- **pages-overlays**: wire drawer island hydration + drain DRAWER-001..004 + REGRESSION
- **pages-navigation**: drain dropdown-menu — render icons + fix top-level schema field pickup
- **pages-navigation**: drain split-button — register dropdown-menu/context-menu as island types
- **bootstrap**: drain APP-SCHEMA-BOOTSTRAP-001..011 + REGRESSION

### Bug Fixes

- **realtime**: dedup presence-sync by user.id, make leave connection-aware
- **cli**: honor --help on update command (CLI-COMMANDS-UPDATE-001)
- **forms**: coerce scalar values to arrays for multi-select column inserts (APP-FORMS-INLINE-CREATE-001)
- **cli**: short-circuit start --help to prevent watch-mode hang (CLI-COMMANDS-START-005)
- **server**: make SIGUSR1 reload atomic with readFileSync (CLI-SERVER-015)
- **specs**: coerce pg NUMERIC/INT8 to JS number in fixtures (unblock cross-dialect rollup/count/lookup)
- **tables**: resolve FK column via reciprocalField in rollup and count generators
- **admin**: consolidate audit-log store — route bucket emits through emitAuditEvent
- **admin**: tighten audit-log schema + emit nextCursor: null (Wave 3 merge)
- **admin**: reconcile Lane A + Lane B audit-log keystone merge (Wave 3)
- **pages-overlays**: import pickCompField — Wave 2 Lane B/C merge interaction bug

### Refactoring

- **component-registry**: collapse file-upload field-extraction via pickCompField
- **islands**: slider — extract thumb + aria-sync hook, drop eslint-disable
- **islands**: select — split SearchableSelect/PlainSelect, drop eslint-disable
- **islands**: number-input — extract hook + StepperButton, drop eslint-disable
- **islands**: file-upload — extract validators + hook, drop eslint-disable
- **islands**: date-picker — extract sub-components, drop eslint-disable
- **form-controls**: satisfy functional-immutable + max-lines lint
- **forms**: lint-fix the APP-FORMS-088/090/091/093 drain — functional patterns + import order

### Documentation

- **progress**: refresh SPEC-PROGRESS.md (0f63fdf15)
- **progress**: refresh SPEC-PROGRESS.md (476264d7a)
- **progress**: refresh SPEC-PROGRESS.md (32f2f04)
- **planning**: decision plan for 204 remaining strict .fixme tests
- **progress**: mirror Wave 5 audit doc update (afbf513dd)
- **testing-strategy**: Wave 5 complete — 3 tables specs parameterized via catalog-helpers adoption
- **progress**: mirror button-field parameterization (5e0a63c02)
- **progress**: mirror required-field parameterization (bb783a5b6)
- **progress**: mirror indexed-field parameterization (8f13ea617)
- **progress**: mirror catalog-helpers extension + user story (7dc56397e)
- **testing-strategy,progress**: Wave 4 complete — cross-dialect catalog helpers + relationships parameterized
- **progress**: mirror catalog-helpers fixture + user story (70bc1ba46)
- **testing-strategy,progress**: Wave 3 complete — SQLite INSTEAD OF triggers unblock rollup/count/lookup
- **progress**: refresh after Phase 2 landmine fixes (CLI-SERVER-015 + CLI-COMMANDS-START-005 + APP-FORMS-INLINE-CREATE-001)
- **progress**: refresh SPEC-PROGRESS.md after Wave 2 audit doc update (7bd49aad8)
- **testing-strategy**: Wave 2 investigation log — decimal-as-string unblock attempt reverted, root-cause taxonomy refined
- **progress**: refresh SPEC-PROGRESS.md after fixture numeric-coercion fix (8bd4b5238)
- **triage**: landmine triage decisions for cleanup batch
- **progress**: refresh SPEC-PROGRESS.md after Phase 5 finalization (8ddd57545)
- **security,testing**: finalize ADR-016 coverage doc + pre-launch-security recommendation
- **progress**: refresh SPEC-PROGRESS.md after assign-users parameterization (d6d45ec8c)
- **progress**: refresh SPEC-PROGRESS.md after admin-api groups parameterization (3280f22c9)
- **progress**: refresh SPEC-PROGRESS.md after forms display parameterization (1c920cc7b)
- **progress**: refresh SPEC-PROGRESS.md after table-level-access-control parameterization (61253af00)
- **progress**: refresh SPEC-PROGRESS.md after group-table-permissions parameterization (7657d7972)
- **progress**: refresh SPEC-PROGRESS.md after eachDialect helper introduction (49e6002bc)
- **progress**: refresh SPEC-PROGRESS.md after cross-dialect coverage audit (4b584526c)
- **testing-strategy**: audit DB-driven specs for cross-dialect parameterization (ADR-016 follow-up)
- **progress**: refresh SPEC-PROGRESS.md after ADR-016 SQLite INTEGER id alignment (ea157a050)
- **adr**: add ADR-016 for dynamic-table id shape alignment across dialects
- **progress**: refresh SPEC-PROGRESS.md after rollup/count reciprocalField fix (2651a7d77)
- **progress**: regenerate after Wave 5 merge — drain automations + admin-automations + pages-social
- **progress**: regenerate after Wave 4 merge — drain eco + admin-forms + layout + data-components
- **progress**: mirror ecoconception/low-data-mode drain
- **progress**: mirror ecoconception/dashboard-overview drain
- **progress**: regenerate after Wave 3 merge — drain admin + cli + form-controls + buckets
- **progress**: mirror ADMIN-CONFIG-VERSION + ADMIN-TABLES-OVERVIEW drain (c5bbce01f)
- **progress**: regenerate after Wave 2 merge + add availability.closedPage YAML example
- **progress**: mirror bootstrap drain (12 specs ⏳→✅)

### Styles

- **docs**: re-align prettier markdown tables (formatting only)
- **admin-automations**: prettier-format Lane B route file
- **eco**: prettier-format the new domain test files
- **renderers**: prettier-format after renderContent removal
- **audit-log**: drop trailing blank line in in-memory-store.ts
- **admin**: prettier-format chainAdminAuditLogRoutes wrapper

### Tests

- **infrastructure**: align API-DB-PROVIDER-030 with Wave 3 INSTEAD OF triggers
- **tables**: parameterize button-field @regression across postgres and sqlite (Wave 5 — catalog helpers adoption)
- **tables**: parameterize required-field @regression across postgres and sqlite (Wave 5 — catalog helpers adoption)
- **tables**: parameterize indexed-field @regression across postgres and sqlite (Wave 5 — catalog helpers adoption)
- **tables**: parameterize relationships @regression across postgres and sqlite (Wave 4 — catalog helpers)
- **tables**: parameterize rollup/count/lookup @regression across postgres and sqlite (Wave 3)
- **authentication**: parameterize assign-users-to-multiple-groups @regression across postgres and sqlite (ADR-016)
- **authentication**: parameterize admin API for group management @regression across postgres and sqlite (ADR-016)
- **forms**: parameterize form display overrides @regression across postgres and sqlite (ADR-016)
- **tables**: parameterize table-level access control @regression across postgres and sqlite (ADR-016)
- **authentication**: parameterize group-based table permissions @regression across postgres and sqlite (ADR-016)
- **eco**: tighten overview.test.ts loop literal types (typecheck fix)
- **eco**: add domain-coverage tests for Wave 4 Lane A's new env parsers
- **pages-overlays**: drain APP-PAGES-TOOLTIP-002 + REGRESSION

### Chores

- **generated**: refresh embedded runtime, CSS, and coming-soon registry artifacts
- **specs**: extend catalog-helpers with getColumnCount + getViewExists (Wave 5 — broader adoption)
- **specs**: add cross-dialect catalog-helpers fixture (Wave 4 — unblock relationships.spec.ts)
- **specs**: introduce eachDialect helper for cross-dialect @regression coverage
- **admin-automations**: trim unused max-lines disable directive
- **drain**: defer APP-PAGES-PUBLIC-COMMENTS-036 — spec asserts truthy fixture return (void)
- **drain**: defer concurrency-queueing spec — async scheduler + schema both missing
- **drain**: defer 3 auth-trigger specs — Better Auth → Effect dispatch bridge missing
- **drain**: defer 3 runs-api specs — async runtime + filter-status + removed notifications
- **drain**: defer 4 state-action specs — Drizzle bun-sql jsonb double-encoding bug
- **renderers**: delete unused renderContent function (Knip)
- **admin,layout**: eslint cleanup for Wave 4 merge
- **drain**: runtime-filter-builder APP-RUNTIME-VIEWS-001..007 deferred
- **drain**: save-personal-views APP-RUNTIME-VIEWS-016..022 deferred
- **drain**: user-table-preferences APP-RUNTIME-VIEWS-027..031 deferred
- **drain**: share-saved-views APP-RUNTIME-VIEWS-023..026 deferred
- **drain**: runtime-grouping APP-RUNTIME-VIEWS-032..035 deferred
- **drain**: quick-edit-drawer APP-PAGES-RECORD-DETAIL-009..012 deferred
- **drain**: APP-PAGES-CONTENT-001/002/003/004/005 + RICH-TEXT-REGRESSION deferred — text component does not yet support props.format:markdown; markdown rendering only available via page.markdown (MarkdownArticle), wiring into the text component is feature work outside drain scope
- **drain**: APP-PAGES-CONTENT-025/026/027/028 + TOC-REGRESSION deferred — TOC component renderer not implemented (no 'toc' entry in component registry, no toc-island; building heading-extraction TOC + sticky-TOC client behavior is feature work outside drain scope)
- **audit-log**: trim unused eslint-disable directives in store.ts
- **admin**: delete unused Wave 3 keystone-duplicate exports
- **form-controls**: eslint-disable Wave 3 Lane C debt with refactor markers
- **drain**: CLI-SERVER-018..023 deferred — DEC-023 reload-versioning not yet implemented
- **drain**: APP-FORMS-118..127 + ANALYTICS-REGRESSION deferred — admin dashboard backend not yet built
- **drain**: APP-FORMS-147 + APP-FORMS-137 deferred — schema design conflict

## [0.7.2](https://github.com/sovrium/sovrium/compare/v0.7.1...v0.7.2) (2026-05-24)

Fix timeline CSS variable race in regression spec (10× stress-tested)

## [0.7.1](https://github.com/sovrium/sovrium/compare/v0.7.0...v0.7.1) (2026-05-24)

Release 0.7.1

## [0.7.0](https://github.com/sovrium/sovrium/compare/v0.6.2...v0.7.0) (2026-05-23)

v0.7.0 — minor release replacing the prematurely-tagged v1.0.0 (audit-log removal is not a breaking change pre-stable)

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
