## [0.17.0](https://github.com/sovrium/sovrium/compare/v0.16.0...v0.17.0) (2026-07-21)

### Features

- **pages**: tab-root docs breadcrumb + contribution footer
- **pages**: syntax-highlight the code component via Shiki

### Bug Fixes

- **cli**: debounce watch-mode config reload to avoid partial-file reads
- **pages**: preserve author attributes on syntax-highlighted code blocks
- **db**: boot against existing Postgres data when a CHECK constraint tightens
- **db**: boot against an existing SQLite database on schema changes

## [0.16.0](https://github.com/sovrium/sovrium/compare/v0.15.2...v0.16.0) (2026-07-20)

### BREAKING CHANGES

- remove the cloud feature domain
- remove the agent-templates feature

### Features

- **pages**: name the demo notice and add one-click sign-in prefill
- **pages**: add an opt-in demo notice for instances published as demos
- **forms**: resolve $t: redirect urls, $record.<column> redirect vars, and embedded/hidden $query prefill

### Bug Fixes

- **tables**: build multi-select member CHECK on the option VALUE for object options
- bound admin overview roll-up latency and query cost to stop 504

## [0.15.2](https://github.com/sovrium/sovrium/compare/v0.15.1...v0.15.2) (2026-07-19)

### Bug Fixes

- **css**: emit arbitrary-var popup surfaces in the binary + cache-control policy

## [0.15.1](https://github.com/sovrium/sovrium/compare/v0.15.0...v0.15.1) (2026-07-18)

### Bug Fixes

- **migrations**: make dynamic-table schema re-init idempotent across upgrades (DEC-063)

## [0.15.0](https://github.com/sovrium/sovrium/compare/v0.14.0...v0.15.0) (2026-07-18)

### Bug Fixes

- **theming**: mint shadcn-convention alias utilities on the default theme (DEC-060)
- **tables**: admit anonymous read of read:all tables (DEC-059)
- **i18n**: localize the data-table create-record affordance (DEC-061)
- **server**: drop Hono context param from the empty-chunk stub helper
- **pages**: normalize colored status options for kanban group-by
- **build**: pad zero-byte island split chunks that broke production hydration

## [0.14.0](https://github.com/sovrium/sovrium/compare/v0.13.0...v0.14.0) (2026-07-17)

### Features

- navbar hover-to-open, authored trigger override, and child target/rel
- **cli**: scaffold init from remote GitHub template repositories
- **templates**: ship deploy + mirror files with every template
- **ai**: boot AI agents inert when no provider is configured (DEC-057)
- navbar badges, dropdown chevron, and inverted popup (DEC-056)
- **examples**: add automation-recipes and knowledge-base templates
- **examples**: add the company-os flagship template
- **website**: re-slice docs sub-nav into 8 product tabs + chrome polish
- **examples**: add people, events, assets, and expenses business apps
- **examples**: add projects, helpdesk, and content-calendar business apps
- serve contentDir.index at the collection base path (DEC-054)
- **pages**: shared component templates host interactive islands
- **website**: fuse a docs zone sub-nav under the top navbar
- add the "Built with Sovrium" badge with free one-line removal

### Bug Fixes

- navbar chevron inherits currentColor and rotates when the menu is open

## [0.13.0](https://github.com/sovrium/sovrium/compare/v0.12.1...v0.13.0) (2026-07-14)

### Features

- **server**: env-gated legacy-host → canonical-path 301 redirect

### Bug Fixes

- bound the automation email SMTP send so a slow gateway can't stall the request
- dedupe @codemirror/state so schema-editor islands hydrate
- add Better Auth 1.6.23 twoFactor columns (failedVerificationCount, lockedUntil)
- preserve per-route Content-Security-Policy for signed downloads
- **server**: serve public assets with correct Content-Type; enforce structural CSP
- **admin-login**: surface auth errors, fix cramped card padding, restore pointer cursor
- **tables**: split many-to-many fields on record update (CALENDAR-010/011/012)
- **tables**: admin-equivalent roles bypass field-level write permissions (CALENDAR-004/005)
- **database**: support a view-backed table that is also a rollup source
- **forms**: localize embedded forms per host locale + opt-in title heading level
- **pages**: localize the docs last-updated date value per active locale
- **pages**: drive the RSS feed channel identity from the rss page meta
- **automations**: provide PackageResolver to record-event code actions
- attribute record actions to the triggering user via runAs (DEC-049)
- **lookup**: preserve an explicit id on view-backed INSTEAD OF INSERT

## [0.12.1](https://github.com/sovrium/sovrium/compare/v0.12.0...v0.12.1) (2026-07-12)

### Bug Fixes

- **db**: restore released 0000 migration identity, undo illegal squash

## [0.12.0](https://github.com/sovrium/sovrium/compare/v0.11.0...v0.12.0) (2026-07-12)

### Features

- **pages**: add contentDir.editUrl + localize docs-article chrome (P13)
- per-page markdown export, copy/view-as-markdown, last-updated stamp
- **pages**: source RSS feed items from a markdown-file page
- render named empty-state region for system-bound charts
- honor chart props[aria-label] as the SVG accessible name
- **data-table**: render query-echoing no-match status distinct from empty state
- **pages**: wire inline-select-edit column action + custom-endpoint form submit
- **pages**: inline-select-edit column action + custom-endpoint form submit
- **file-upload**: wire upload-submission runtime + onSuccess/onError effects
- **pages**: file-upload submission + onSuccess effects (foundation, RED)
- **account**: pending-erasure returns the caller's email
- **gdpr**: pending-erasure read, relative-time column, download onSuccess effects
- **pages**: wire object-form confirm, session-bound text, onSuccess effects
- **pages**: add confirm-object, session-bound text, and action onSuccess status/refetch vocabularies
- **record-drawer**: compose the actions/role/renderAs trio with system bindings
- **record-drawer**: wire actions footer, configurable role/name, structured fields
- **record-drawer**: add actions slot, configurable role/name, structured field renderer
- **button**: wire standalone button fetch-action runtime (download + confirm gate)
- **button**: accept fetch actions + confirm-gate destructive fetches
- **admin**: convert connections directory to config data-table
- **action**: wire mode:oauth runtime in shared action-executor
- **data-table**: wire visibleWhen action gating + valueLabels render runtime
- **data-table**: add visibleWhen action gating and valueLabels column display map
- **admin**: rewire admin chrome to config-native command-palette + dropdown-menu (CAP-5 C3)
- **islands**: convert runs filter bar onto the config shared-filter binding — CAP-5 C2 admin
- **islands**: cross-component shared-filter binding (config sharedFilter/bindTo) — CAP-5 C2 generic
- **pages**: system-source catalog resolution via SSR desugar (CAP-4)
- **admin**: automation-run retry endpoint + config action (CAP-3)
- **islands**: data-users system actions via Better-Auth config fetch actions (CAP-3)
- **islands**: thread row record into data-table fetch-action dispatch
- **islands**: buckets file-row download via config mode:download action
- **islands**: action-executor download + navigate modes + GDPR export download
- **islands**: system operate action — core-mutate executor + GDPR erase/cancel conversion
- **islands**: wire page-level system single-record binding (CAP-2)
- **islands**: wire record-drawer system detail-endpoint binding (CAP-2)
- **islands**: wire CAP-2 system detail/single binding for record-field
- **islands**: wire CAP-1 system-source rows binding for list
- **islands**: wire CAP-1 system-source rows binding for data-timeline
- **islands**: wire CAP-1 system-source rows binding for calendar
- **islands**: wire CAP-1 system-source rows binding for kanban
- **islands**: wire CAP-1 system-source rows binding for gallery
- **chart**: add a system read-endpoint series data source binding
- **kpi**: add a system read-endpoint value-path data source binding
- **admin**: connect / reconnect / disconnect row actions on the connections directory
- **admin**: OAuth2 connect/callback/disconnect admin action endpoints
- **data-table**: add a permission-gated "Nouvel enregistrement" create flow to the data-table toolbar
- **admin**: sidebar global search UI grouped by type + record deep-link drawer
- **admin**: GET /api/admin/search global indexed search endpoint (dual-dialect FTS)
- **admin**: _admin_search_index dual-dialect migrations + SQLite FTS5 DDL
- **admin**: add dashboard overview at /_admin root
- **admin**: account page — identity card + "Mon compte" naming (Wave 3 F)
- **admin**: start a new agent conversation from the Conversations page (Wave 3 M)
- **admin**: admin bucket file-upload endpoint + wire the upload modal (Wave 3 N)
- **admin**: sidebar object toggles + automation/agent run filters (Wave 2 C+D)
- **admin**: Wave 1 dashboard IA + affordance polish (sidebar, profile menu, modals)
- **admin**: surface per-form analytics panel on the Soumissions selected-form page
- **admin**: add the App Connections data page to the operational console
- **admin**: add the Agents Conversations data page to the operational console
- **admin**: add the Buckets Files data page to the operational console
- **admin-dashboard**: Data-tab Statistiques page (page analytics)
- **admin-dashboard**: Data-tab Utilisateurs page (account directory)
- **admin**: rich config-list table — metadata columns, row actions, create/rename modals, per-item unpublished state
- **admin**: per-element config metadata, diff, rename-cascade + duplicate
- **admin-dashboard**: Data-tab Soumissions page (form submissions inbox)
- **admin-dashboard**: Data-tab Exécutions page (automation run history)
- **admin-dashboard**: Data-tab Enregistrements page (table records grid)
- **admin-dashboard**: top-level Config/Données sidebar tab + Data routing
- **admin-dashboard**: content-only (SPA) shell navigation
- **admin-dashboard**: cross-cutting a11y + responsive + parity (completes Tier 2)
- **admin-dashboard**: cross-cutting — search palette, operators, MCP connect, GDPR
- **admin-dashboard**: Tier 2f per-domain metrics backends + page edit history
- **admin-dashboard**: Tier 2b Tier-B CRUD + Tier 2d drift watcher/banner
- **admin-dashboard**: Tier 2e sandbox preview TTL + Aperçu lifecycle
- **admin-dashboard**: Tier 2c transport taxonomy + activity feed + versioning
- **admin-dashboard**: Tier 2a Agents dashboard + in-product chat (completes 2a)
- **admin-dashboard**: Tier 2a Theme + Languages + Env + Notifications
- **admin-dashboard**: Tier 2a Connections + Components + Actions + Scripts
- **admin-dashboard**: Tier 2a Forms + Auth + Buckets dashboards
- **admin-dashboard**: Tier 2a Pages + Automations dashboards
- **admin-dashboard**: Tier 2a Tables domain dashboard (tables + tables-data)
- **admin-dashboard**: Tier 2 fidelity foundation + spec reconciliation + fixes
- **admin-dashboard**: Tier 1 editing surfaces — shell, editor, publish, login (MVP)
- **admin-dashboard**: Tier 0 foundations + /_admin/login spec
- **pages**: config-driven docs nav-section icons (contentDir.nav.groupIcons)
- **docs**: redesign docs navigation, Welcome page, and install guide

### Bug Fixes

- **tables**: don't run view-backed id resolution on composite-key tables
- **tables**: correct DEC-048 many-to-many types and clear batch-3 quality drift
- complete m2m-on-create for view-backed tables and the form path (DEC-048)
- split many-to-many fields on record create and resolve them on read (DEC-048)
- view-backed insert applies base DEFAULTs and returns the real id (DEC-047)
- **comments**: opt-in per-user comment read/unread state (DEC-045)
- **theme**: raise --sv-fg-subtle to WCAG AA contrast in light and dark
- **pages**: render the default 404/500 pages with theme tokens
- exclude soft-deleted child rows from rollup and count aggregates
- apply admin-equivalent override to field-level read filtering
- enforce permissions.comment server-side (DEC-046)
- **pages**: emit absolute hreflang alternates sharing the canonical origin
- hide role-gated embedded form references
- **tables**: resolved top custom role bypasses row-level scoping (GAP #1)
- clamp cron setTimeout delay to avoid 32-bit overflow busy-loop
- **auth**: route every admin-tier guard through one isAdminTier predicate
- **connections**: resolve $env.VAR in oauth2 props before the provider flow
- admit custom top-role operators to OpenAPI docs endpoints
- **tables**: make user-preferences + saved-views repos dialect-aware (SQLite 500)
- **admin**: render typed create-form controls in the record grid
- **ai**: make Ollama agent chat work out of the box (no API key)
- **account**: make GDPR self-service export work on the SQLite default
- **build**: stop license script from double-stamping generated CSS assets
- **auth**: exclude agent service users from admin-bootstrap preconditions
- **admin**: diff against effective baseline (published-else-booted)
- **security**: tolerate attribute/junk HTML end tags in search-index regexes

## [0.11.0](https://github.com/sovrium/sovrium/compare/v0.10.0...v0.11.0) (2026-06-17)

### Features

- RAG Phase 2 — opt-in sqlite-vec ANN + FTS5 hybrid retrieval (DEC-029)
- **pages**: alert-dialog confirm dispatches its configured automation action (DEC-037)
- **automations**: approval action pauses run, resolves via run-scoped approve/reject (DEC-037)
- record-context submit fields for schema-config editors
- hydrate reverse one-to-many collections in record-trigger envelope (GAP-J2)
- docs-article breadcrumb + "View as Markdown" header
- implement tail-logs host effect for host log drain
- icon variant for theme-toggle component
- TOC scroll-spy + prose spacing fixes for docs markdown
- collapsible docs sidebar via contentDir.nav.collapsed
- content-body search with highlighted excerpts in command palette
- add commandPalette opt-out to AppSchema
- **pages,forms,automations**: KPI SSR label, $record prefill, relationship hydration, validate-config (Clusters I+J)
- **apps/docs**: adopt groupLabels, JSON-LD synthesis, generated llms.txt, theme toggle with light mode
- **theming**: theme-toggle component, theme.colorScheme, no-FOUC color-scheme head script
- **seo**: auto-generate /llms.txt and /llms-full.txt from contentDir pages
- **seo**: auto-synthesize TechArticle + BreadcrumbList JSON-LD for contentDir pages
- **pages**: contentDir nav groupLabels + humanize, skip link, code-copy button
- **automations,tables**: comment-thread email recipients + composite row-level predicates (Cluster E)
- **pages**: read-only record-field display + dialog mounts closed (platform gap Cluster D)
- **islands**: structured-form & AI-agent schema-config editors (platform gap B10)
- **automations**: host env-var injection with secret resolution (platform gap B9)
- **automations**: per-app resource-quota registry (platform gap B5)
- **automations**: reverse-proxy ingress + custom-domain TLS (platform gap B4)
- **automations**: multi-version process supervisor registry (platform gap B2)
- **automations**: per-tenant database provisioning registry (platform gap B3)
- **automations**: cloud orchestration action handler (platform gap B1)
- **islands**: JSON & YAML schema-config editors (platform gap B10)
- **auth**: role-aware login landing (onSuccess role-landing)
- **forms**: configurable/localizable CRUD labels + dialog formRef

### Bug Fixes

- resolve ESLint issues from the docs UX-fix campaign
- do not force inline display:inline-block on image elements
- **css**: apply precompiled-file gate in production CSS branch
- **forms,partner**: visibility-gated formRefs don't 404 the page — resolve FORMS-017
- **automations**: hydrated record fields stringify as their FK id
- **pages,forms**: automation/logout buttons + embedded-form runtime (Cluster H)
- **auth**: respect display:none hide-gate on full-width auth-form wrapper
- **seo**: recognize hardcoded-language page paths in sitemap and hreflang alternates
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
- **security**: SSRF-guard file:upload action source resolution (Finding #8)
- **tables**: single-record GET row-level read 404'd users on their own id-scoped record
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

## [0.9.0](https://github.com/sovrium/sovrium/compare/v0.8.1...v0.9.0) (2026-05-31)

### Features

- **infrastructure**: implement user-view + user-table-preferences repository live layers
- **application**: define UserViewRepository + UserTablePreferencesRepository ports
- **api**: add sliding-window rate-limiter for /api/shared-views/*
- **auth**: hydrate SessionInfo.effectiveRoles in session-context resolution
- **domain**: add Zod response schemas for user-views + user-table-preferences
- **application**: extract user-table-preferences use-cases as Effect programs
- **application**: extract user-views use-cases as Effect programs
- **account**: emit account.deletion.scheduled + purged audit events
- **infrastructure**: add Drizzle-backed audit-log store with dual-dialect helpers
- **api**: add audit-log action-catalog entries for account.deletion.scheduled + purged
- **db**: drizzle migrations restoring audit_log for PG + SQLite
- **domain**: add audit-log Drizzle schema for PG + SQLite (Phase 8 Cycle 1a — design)
- **api**: validate PATCH bodies for user-table-preferences + user-views
- **domain**: add Zod PATCH schemas for user-prefs + user-views
- **design-system**: Phase 5 contract proof — drift gate + smoke tests + ECO_DESIGN_LAYER env var
- **design-system**: add + prestyle read-only cell renderers (user/relational/status/formula/geolocation/count/json/array/code)
- **runtime-views**: APP-RUNTIME-VIEWS-026 + regression — 404 for cross-table share
- **design-system**: prestyle field-type affordances (rating/currency/percentage/color/attachments) with var-fallback recipe
- **runtime-views**: APP-RUNTIME-VIEWS-024..025 — URL contract + shared-view lookup
- **design-system**: prestyle specialty + ai surfaces (comments/lang-switcher/reorderable-list/time-picker/ai-chat) with var-fallback recipe
- **runtime-views**: APP-RUNTIME-VIEWS-023 — Share button generates view link
- **design-system**: prestyle interactive + content surfaces (link/button-group/icon/image/iframe/audio/video/search) with var-fallback recipe
- **design-system**: prestyle display surfaces (carousel/empty-state/list-item/scroll-area/speech-bubble/static-table/timeline) with var-fallback recipe
- **runtime-views**: drain remaining save-personal-views + cycle-4 deferred fixmes
- **runtime-views**: wire saved-views surface for APP-RUNTIME-VIEWS-016
- **data-table**: runtime group-by picker + collapsible groups (APP-RUNTIME-VIEWS-032/033/034)
- **design-system**: prestyle typography (heading/paragraph/code/blockquote/list) with var-fallback recipe
- **design-system**: prestyle data surfaces (data-table chrome + kanban + chart shells) with var-fallback recipe
- **pages**: PG-03 APP-RUNTIME-VIEWS-009/011/SORT-REGRESSION — runtime multi-sort + view switcher
- **design-system**: prestyle form surfaces (form-card + file-upload dropzone) with var-fallback recipe
- **design-system**: prestyle layout surfaces (card + divider) with var-fallback recipe
- **pages**: PG-03 APP-RUNTIME-VIEWS-001..007 — runtime filter builder
- **design-system**: prestyle navigation surfaces (breadcrumb/pagination) with var-fallback recipe
- **design-system**: prestyle feedback surfaces (badge/alert/skeleton/progress) with var-fallback recipe
- **pages**: PG-03 APP-RUNTIME-VIEWS-028..031 — user table preferences runtime
- **design-system**: prestyle tabs + accordion islands with var-fallback recipe
- **design-system**: prestyle overlay islands (dialog/popover/tooltip/drawer/menu) with var-fallback recipe
- **design-system**: prestyle date-picker islands with var-fallback recipe
- **design-system**: prestyle numeric islands (number-input, slider) with var-fallback recipe
- **design-system**: prestyle toggle/switch/toggle-group islands with var-fallback recipe
- **design-system**: prestyle select island with var-fallback recipe
- **design-system**: prestyle input renderer with state defaults
- **design-system**: prestyle button-renderer with variant/size/state defaults
- **pages**: PG-04 PATTERN-REGRESSION — tabs renders React children + nested forms get collection record
- **design-system**: land DEC-026 prestyled-default contract + css-var helper
- **pages**: PG-04 APP-PAGES-RECORD-DETAIL-011 + DRAWER-REGRESSION — drawer save closes + sibling table refreshes
- **pages**: PG-02 guest-comment storage + inline form runtime
- **pages**: PG-02 single-level threading — reply UI + collection auto-bind + API depth check
- **pages**: PG-04 APP-PAGES-RECORD-DETAIL-005 — synthesized CRUD update obeys table-update perms
- **data-components**: PG-03 sort-direction indicator (APP-RUNTIME-VIEWS-010)
- **pages**: CA-01 APP-PAGES-CONTENT-013 — alert dismissibility via event-delegated toggle
- **data-components**: PG-03 column-visibility drag-reorder (drain 2)
- **pages**: PG-04 record-detail composition — tabs / openDrawer dispatch / data-form alias / CRUD synthesis (drain 5)
- **pages**: PG-02 moderation pipeline — manual queue + autoApprove + PATCH-status + auth-required (drain 11)
- **css**: ship Source Serif 4 italic via inline @font-face
- **pages**: PG-02 spam guards — rate-limit + link-threshold + blocked-words + guest-comment auth-exemption (drain 9)
- **automations**: wire comment trigger to fire on approved comments (drain 4)
- **pages**: thread session into comment-thread island props (drain 14)
- **pages**: page-search client island — interactive results UX (US-PAGES-PUBLIC-SEARCH-009)
- **pages**: PG-01 — comment thread + count hydration islands (drain 7)
- **pages**: PG-01/PG-02 — SSR comment form skeleton + honeypot + schema foundation (drain 12)
- **pages**: pageSearch SSR placeholder + renderer dispatch (US-PAGES-PUBLIC-SEARCH-001)
- **pages**: pre-boot search-index generation for sovrium start (US-PAGES-PUBLIC-SEARCH-004)
- **pages**: data-sovrium-search-body marker + indexer narrowing (US-PAGES-PUBLIC-SEARCH-007)
- **pages**: Sovrium-native search indexer (US-PAGES-PUBLIC-SEARCH-002)
- **pages**: PG-03 schema+routes foundation — user_saved_views + user_table_preferences (DEC-017)
- **pages**: activation gate predicate + build-path stub (US-PAGES-PUBLIC-SEARCH-003)
- **forms**: F-04 — admin analytics & responses dashboard + drain 11 specs
- **sovrium**: fix 5-bug cluster from sovrium-partner consumer-app
- **pages**: close static-build access leak (US-PAGES-PUBLIC-SEARCH-008)
- **pages**: pageSearch component schema stub + spec corpus (US-PAGES-PUBLIC-SEARCH-001..008)
- **pages**: PG-04 schema prep — OpenDrawerActionSchema + 10 narrowing fixes
- **forms**: F-03 — anti-spam rate-limit + IP hash-on-write + drain 6 specs
- **buckets**: B-01 — attachment field signed-URL enrichment + drain 6 specs
- **schema**: API-1 — schema_prune retention resolver + REST handler + MCP tool + drain 2 specs
- **automations**: AU-03 — auth-event dispatch bridge + drain 3 specs
- **automations**: AU-02 — concurrency scheduler + cancel-mid-flight + drain 2 specs
- **cli**: CLI-LOG-OUTPUT-010/011/012 — quiet better-auth verifier + admin display in banner
- **cli**: C-01 — reload versioning + drift detection (DEC-023) + drain 6 specs
- **admin**: ADM-1 — GET /api/admin/users/overview endpoint + drain 6 specs
- **pages**: P-05 — text component markdown rendering + drain 6 specs
- **pages**: P-06 — TOC renderer (auto-anchor headings, sticky nav) + drain 5 specs
- **pages**: P-07 — add FetchActionSchema + drain 6 toast specs
- **cli**: scaffold public/ in init for web-facing templates
- **infra**: harden setupPublicDirRoute with realpath + secret-blocklist
- **cli**: default --publicDir to <app.yaml dir>/public with opt-out flag
- **pages**: APP-PAGES-TWITTER-APP-REGRESSION — add appUrl deep-link metadata to TwitterCardSchema
- **automations**: RUNS-004 filter halts surface as run.status='skipped' (+ remove fossilized RUNS-011)

### Bug Fixes

- **comments**: return genuine 404 for missing records instead of synthesized envelopes
- **comments**: strip commenter email from comment + record-history APIs
- **islands**: make data-table skeleton rows inert during loading
- **cli**: init scaffolding is additive — never clobbers existing public/ files
- **islands**: restore canonical primary/overlay tokens on form-control + scroll-area islands
- **theme**: destructive button/badge use destructive token, not primary
- **design-system**: F7 hover-card locator + F12 comment-thread Q1/Q2a chrome
- **specs**: APP_SCHEMA_FILE env var for schemas exceeding ARG_MAX
- **css**: safelist runtime-template-literal arbitrary classes (bg-[var(--sv-*,…)])
- **database**: reset getDb() memo to isolate DATABASE_URL-pinning tests
- **audit-log**: silence expected missing-table warning on boot reset
- **auth**: guard set-role update hook against null user for non-existent target
- **cli**: stop sovrium build aborting on a missing publicDir + restore CSS-path log
- **rendering**: guard TOC resolver walkers against string children
- **design-system**: break --sv-bg* cycle so light-mode primary buttons render readable text
- **design-system**: wire V1_ALIAS_BRIDGE for prestyled override channel + document layer-off outlier
- **islands**: generalise operator-vocabulary bridge in evaluatePredicate
- **islands**: bridge UI/API/domain operator vocabularies for is-any-of/is-none-of
- **css**: boost dark cascade specificity to defeat trailing :root rules
- **css**: safelist font-serif so the v1 grace-note utility survives
- **css**: switch Source Serif @font-face to format('woff2')
- **css**: use :is() instead of :where() for dark-mode root cascade
- **css,design-system**: safelist dynamic Tailwind patterns + theme-aware section backgrounds
- **automations**: AU-01 — single-encode jsonb state writes + drain 4 specs
- **cli**: admin create works bare; bootstrap token in startup banner

## [0.8.1](https://github.com/sovrium/sovrium/compare/v0.8.0...v0.8.1) (2026-05-25)

### Bug Fixes

- **database**: MIGRATION-CHECKSUM-VIEW-DRIFT-001 — preserve auto-generated lookup views across boots

## [0.8.0](https://github.com/sovrium/sovrium/compare/v0.7.2...v0.8.0) (2026-05-25)

### Features

- **database**: emit SQLite INSTEAD OF triggers for view-backed tables
- **database**: align SQLite dynamic-table default id to INTEGER (ADR-016)
- **pages-social**: add comments + commentCount page components (SSR scaffolding tier)
- **admin-automations**: drain overview.spec.ts (8 fixmes → GREEN)
- **data-components**: drain runtime-sort-configuration — APP-RUNTIME-VIEWS-008 + a11y polish
- **data-components**: drain runtime-column-visibility — APP-RUNTIME-VIEWS-012/014/015
- **data-components**: drain related-records-display — APP-PAGES-RECORD-DETAIL-013..016
- **data-components**: drain record-header-breadcrumb — APP-PAGES-RECORD-DETAIL-006..008
- **data-components**: drain form-reset-after-success — APP-PAGES-FORM-062
- **pages-layout**: drain divider-spacer specs — divider + spacer renderer bodies
- **pages-layout**: drain divider-spacer — add divider + spacer renderers (HR with style/label, sized div spacer); rename structural-components.ts to .tsx for JSX
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
- **cli**: drain CLI-COMMANDS-AGENTS-001..006 + REGRESSION
- **cli**: drain CLI-COMMANDS-HELP-001..005 + REGRESSION
- **admin**: drain ADMIN-CONFIG-VERSION + ADMIN-TABLES-OVERVIEW
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
- **tables**: resolve FK column via reciprocalField in rollup and count generators
- **admin**: consolidate audit-log store — route bucket emits through emitAuditEvent
- **admin**: tighten audit-log schema + emit nextCursor: null (Wave 3 merge)
- **admin**: reconcile Lane A + Lane B audit-log keystone merge (Wave 3)
- **pages-overlays**: import pickCompField — Wave 2 Lane B/C merge interaction bug

## [0.7.2](https://github.com/sovrium/sovrium/compare/v0.7.1...v0.7.2) (2026-05-24)

### Features

- **i18n**: drain US-I18N-MULTI-LANGUAGE-APPS-REGRESSION
- **ai**: drain APP-AI-CHAT-STREAM-010 via truncate-mode mock seed
- **api**: drain mcp-schema-tools.spec — wire 7 MCP parity tools + family catalog (partial)
- **api**: drain fileenv-launch-seeds-the-version-ledger.spec — DEC-023 boot-time auto-seed

### Bug Fixes

- **islands**: set data-island-ready after Suspense resolves so spec gates see hydrated DOM

## [0.7.1](https://github.com/sovrium/sovrium/compare/v0.7.0...v0.7.1) (2026-05-24)

### Bug Fixes

- **database**: close schema-persistence + lookup-VIEW + webhook-log + ILIKE + JSONB-increment + user_access + CSS-resolver dialect leaks on SQLite
- **database**: close CHECK-constraint + DROP-CASCADE dialect leaks on SQLite
- **database**: make user-field FK constraint dialect-aware (auth.user vs auth_user)

## [0.7.0](https://github.com/sovrium/sovrium/compare/v0.6.2...v0.7.0) (2026-05-24)

### BREAKING CHANGES

- **admin**: remove audit-log feature

### Features

- **pages/navigation**: add triggerLabel to dropdown-menu schema + island
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
- **automations**: embed TypeScript lib.d.ts in compiled binary for runTypescript validator
- **database**: route 21 repositories through dialect-aware schema resolver
- **pages**: tooltip island registry reads tooltipContent from rawProps fallback

## [0.6.2](https://github.com/sovrium/sovrium/compare/v0.6.1...v0.6.2) (2026-05-23)

_No user-facing changes in this release._

## [0.6.1](https://github.com/sovrium/sovrium/compare/v0.6.0...v0.6.1) (2026-05-23)

_No user-facing changes in this release._

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
- **cli**: qualify Homebrew formula as sovrium/tap/sovrium in update command
- **cli**: qualify Homebrew formula as sovrium/tap/sovrium in update command

### Performance Improvements

- **markdown**: extract content-dir filter helper + skip render probe in filter path

## [0.5.3](https://github.com/sovrium/sovrium/compare/v0.5.2...v0.5.3) (2026-05-22)

### Bug Fixes

- **assets**: exclude .ts examples from the embedded manifest
- **types**: fix declaration-emit errors blocking the release build
- **cli**: serve agents + init examples from embedded manifest
- **assets**: embed client/island/script bundles in the compiled binary
- **migrations**: embed drizzle migrations in the compiled binary
- **openapi**: resolve Sovrium version from build-time define in binaries

## [0.5.2](https://github.com/sovrium/sovrium/compare/v0.5.1...v0.5.2) (2026-05-21)

_No user-facing changes in this release._

## [0.5.1](https://github.com/sovrium/sovrium/compare/v0.5.0...v0.5.1) (2026-05-21)

### BREAKING CHANGES

- configure SQLite path via DATABASE_URL file: scheme, remove SQLITE_PATH

### Features

- **cli**: make `sovrium update` work regardless of install source

### Bug Fixes

- **cli**: repair Linux Homebrew/curl install + Scoop checksum

## [0.5.0](https://github.com/sovrium/sovrium/compare/v0.4.10...v0.5.0) (2026-05-21)

### Features

- **eslint**: ban literal palette colors in islands (design-system token guardrail)
- **css**: add mode-invariant scrim token for modal backdrops
- **api**: apply additive schema migrations live on publish (no restart)
- **islands**: add cn() class-merge primitive with canonical token groups
- **css**: inject design-system v1 as default token layer
- **eco**: wire ECO_IMAGE_FORMAT env var per standing rule R1
- **presentation**: add Effect.Stream → SSE bridge utility
- **pages,ai**: activate toast actions, agent tool-calling, agent RAG memory
- **automations**: activate file-action handlers (compress/extract-text/transform-image/generatePdf)
- add static page-output cache (ECO_PAGE_CACHE)
- **records-api**: real-time connection-status indicator
- **records-api**: real-time presence awareness
- **records-api**: real-time conflict detection + reconciliation
- **database**: close sqlite records-api + form + version + bootstrap gaps
- **records-api**: WebSocket transport for real-time subscriptions
- **records-api**: live SSE change-event delivery + subscription filtering
- **records-api**: data-table poll-mode auto-refresh
- **server**: boot with sqlite as default database
- **auth**: support sqlite provider in better-auth
- **database**: graceful degradation for sqlite mode
- **database**: sqlite dynamic-table ddl executor
- **database**: dialect-aware records crud callsite migration
- **records-api**: extend realtime API schemas for change/conflict/presence/transport
- **database**: dialect-aware ddl type mapping and literals
- **database**: dialect-aware raw-sql executor and introspection
- **database**: dual-dialect drizzle client
- **database**: dialect-aware drizzle-kit config
- **database**: add sqlite-core schema mirror
- **database**: add database dialect resolver

### Bug Fixes

- enforce S1 anti-enumeration + close RAG/validation/form gaps
- **css**: resolve zero-config island theming rendering unstyled surfaces
- **css**: emit hardcoded red palette via @theme static for dev/binary parity
- **css**: stop CSS compiler OOM from self-amplifying candidate scan
- **islands**: hydrate dialog/alert-dialog on standalone pages
- **css**: satisfy lint on default-theme-layer size + cn() test
- **autosave**: preserve pre-hydration form values + relax debounce wait
- **s1**: refine Better Auth 403→404 rewrite + align legacy specs
- **schema**: include source + fileChecksum in get-version projection
- **s1**: collapse remaining 403 sites in delete/read/comment handlers
- **auth**: collapse Better Auth admin/org 403 to 404 (S1)
- **s1**: return 404 for all unauthorized access — anti-enumeration
- **merge**: resolve post-merge ESLint nits
- **database**: close residual sqlite boot-path + schema-checksum gaps
- **pages**: repair post-merge regressions from drain branch merges

## [0.4.10](https://github.com/sovrium/sovrium/compare/v0.4.9...v0.4.10) (2026-05-18)

### Bug Fixes

- **server**: use a tagged error in validateStoragePublicAccessEnv

## [0.4.9](https://github.com/sovrium/sovrium/compare/v0.4.8...v0.4.9) (2026-05-18)

### Features

- **pages**: data-timeline component basic view
- **pages**: command palette quick actions
- **buckets**: public/private file access toggle
- **pages**: global command palette activation
- **buckets**: signed upload URLs with PUT serve path
- **records-api**: subscription handshake route alias
- **pages**: KPI grid layout with sparklines and thresholds
- **records-api**: real-time connection management specs
- **pages**: KPI card data component
- **pages**: cross-table search in command palette
- **records-api**: poll-mode interval validation
- **pages**: paste spreadsheet rows with type-mismatch flagging + undo
- **buckets**: single signed-URL endpoint with bucket RBAC
- **records-api**: data-source refreshMode configuration
- **pages**: form successPage onSuccess response
- **pages**: clipboard paste preview with column mapping
- **buckets**: batch signed-URL generation
- **pages**: copy data-table rows/cells to clipboard
- **buckets**: image transform LRU cache with ETag/304 support
- **tables**: real-time subscription SSE endpoint
- **pages**: auto-save status indicator (inline/toast/toolbar positions)
- **buckets**: named thumbnail preset transforms
- **buckets**: image quality (compression) transform parameter
- **tables**: webhook payload customization
- **pages**: file-upload form fields with thumbnails, limits, storage refs
- **pages**: auto-save saveMode configuration (auto/onBlur/manual)
- **tables**: webhook test endpoint with sample payload
- **pages**: form validation feedback — inline errors, summary banner, toasts
- **pages**: favorites + recent items in command palette
- **buckets**: original image preservation guarantees
- **tables**: webhook automatic retry policy with backoff
- **pages**: inline multi-step wizard layout with per-step validation
- **pages**: per-user favorite records with auto-injected star toggle
- **buckets**: on-the-fly image resize with dimension range validation
- **tables**: webhook delivery logs with history, filter, retry
- **pages**: form reset-after-success with preserveFields + wizard reset
- **pages**: reorderable-list component with keyboard reorder
- **buckets**: image format conversion + Accept-header negotiation
- **buckets**: image-transform crop modes (APP-BUCKETS-TRANSFORMS-023..028 + REGRESSION)
- **tables**: webhook authentication (APP-TABLES-WEBHOOKS-011..018 + REGRESSION)
- **buckets**: advanced bucket features + storage env validation (APP-BUCKETS-ADVANCED-001..004 + REGRESSION)
- **tables**: per-table outgoing webhooks (APP-TABLES-WEBHOOKS-001..010 + REGRESSION)
- **pages**: data-chart series styling (APP-PAGES-CHART-012..016 + REGRESSION)
- **pages**: form auto-save (APP-AUTOSAVE-023..028 + REGRESSION)
- **tables**: advanced table features (APP-TABLES-ADVANCED-001..007 + REGRESSION)
- **pages**: data-chart legend + tooltip (APP-PAGES-CHART-017..020 + REGRESSION)
- **pages**: data-chart axis labels (APP-PAGES-CHART-007..011 + REGRESSION)
- **pages**: data-table auto-save debounce timing (APP-AUTOSAVE-006..010 + REGRESSION)
- **records-api**: optimistic-lock conflict detection on record update (APP-REALTIME-042/046/047)
- **pages**: implement data-chart aggregate functions (APP-PAGES-CHART-021..024 + REGRESSION)
- **pages**: implement data-table inline auto-save (APP-AUTOSAVE-017..022 + REGRESSION)

### Bug Fixes

- **buckets**: evict transform cache on file delete

## [0.4.8](https://github.com/sovrium/sovrium/compare/v0.4.7...v0.4.8) (2026-05-18)

_No user-facing changes in this release._

## [0.4.7](https://github.com/sovrium/sovrium/compare/v0.4.6...v0.4.7) (2026-05-18)

_No user-facing changes in this release._

## [0.4.6](https://github.com/sovrium/sovrium/compare/v0.4.5...v0.4.6) (2026-05-18)

### Bug Fixes

- compile theme-aware CSS in the standalone binary without native addons

## [0.4.5](https://github.com/sovrium/sovrium/compare/v0.4.4...v0.4.5) (2026-05-18)

_No user-facing changes in this release._

## [0.4.4](https://github.com/sovrium/sovrium/compare/v0.4.3...v0.4.4) (2026-05-18)

_No user-facing changes in this release._

## [0.4.3](https://github.com/sovrium/sovrium/compare/v0.4.2...v0.4.3) (2026-05-18)

_No user-facing changes in this release._

## [0.4.2](https://github.com/sovrium/sovrium/compare/v0.4.1...v0.4.2) (2026-05-18)

_No user-facing changes in this release._

## [0.4.1](https://github.com/sovrium/sovrium/compare/v0.4.0...v0.4.1) (2026-05-18)

### Features

- **automations**: implement digest/release automation action (APP-AUTOMATION-ACTION-DIGEST-RELEASE-001..002 + REGRESSION)
- **automations**: implement digest/collect automation action (APP-AUTOMATION-ACTION-DIGEST-COLLECT-001..002 + REGRESSION)
- **automations**: implement crypto/hash and crypto/hmac automation actions (APP-AUTOMATION-ACTION-CRYPTO-HASH-001, HMAC-001 + REGRESSION)
- **automations**: implement auth/unbanUser automation action (APP-AUTO-AUTH-UNBANUSER-001..003 + REGRESSION)
- **automations**: implement auth/createUser automation action (APP-AUTO-AUTH-CREATEUSER-001..003 + REGRESSION)
- **automations**: implement auth/banUser automation action (APP-AUTO-AUTH-BANUSER-001..003 + REGRESSION)
- **automations**: implement auth/assignRole automation action (APP-AUTO-AUTH-ASSIGNROLE-001..003 + REGRESSION)
- **automations**: implement approval/request automation action (APP-AUTOMATION-ACTION-APPROVAL-REQUEST-001..002 + REGRESSION)
- **automations**: implement analytics/track automation action (APP-AUTOMATION-ACTION-ANALYTICS-TRACK-001..003 + REGRESSION)
- **automations**: tool-call validation for ai/agent action (APP-AUTOMATION-ACTION-AI-ERROR-006)
- **automations**: implement ai/agent automation action (6/9 APP-AUTOMATION-ACTION-AI-AGENT + REGRESSION)
- **auth**: enforce group maxMembers capacity (APP-AUTH-GROUPS-026..030 + REGRESSION)
- **auth**: implement group-based table permissions (APP-AUTH-GROUPS-014..020 + REGRESSION)
- **auth**: implement group-based page access control (APP-AUTH-GROUPS-021..025 + REGRESSION)
- **auth**: implement group-aware permission evaluation (APP-AUTH-GROUPS-008..013 + REGRESSION)
- **auth**: implement admin API for group management (API-AUTH-GROUPS-001..014 + REGRESSION)
- **api**: implement schema-management version restore (APP-SCHEMA-VERSIONS-001..008 + REGRESSION)
- **api**: implement schema-management draft publish (APP-SCHEMA-PUBLISH-001..008 + REGRESSION)
- **security**: GDPR account export & deletion endpoints
- **api**: implement schema-management draft preview (APP-SCHEMA-PREVIEW-001..012 + REGRESSION)
- **api**: implement schema-management status endpoint + enablement gate (APP-SCHEMA-ENABLEMENT-001..004 + REGRESSION)
- **api**: implement schema-management draft lifecycle (APP-SCHEMA-DRAFT-001..011 + REGRESSION)
- **api**: implement schema-management draft REST resources (APP-SCHEMA-DRAFT-RESOURCES-001..015 + REGRESSION)
- **api**: implement MCP schema-management tools (APP-AI-MCP-SCHEMA-TOOLS-001..013 + REGRESSION)
- **ai**: implement ai-tag compute trigger + model override (APP-AI-CONFIG-048..050 + REGRESSION)
- **ai**: require AI_MODEL for openai-compatible provider (APP-AI-CONFIG-022..025 + REGRESSION)
- **ai**: implement base-URL config for Ollama / local AI providers (APP-AI-CONFIG-017..021 + REGRESSION)
- **ai**: propagate field-level maxTokens to AI compute calls (APP-AI-CONFIG-038)
- **ai-chat**: implement automation triggering from chat (APP-AI-CHAT-TRIGGER-001..012 + REGRESSION)
- **ai-chat**: implement AI chat tool calling (12/13 APP-AI-CHAT-TOOL specs + REGRESSION)
- **ai-chat**: implement AI chat record queries (APP-AI-CHAT-QUERY-001..015 + REGRESSION)
- **ai**: enforce RBAC on knowledge-table embedding
- **ai**: document knowledge ingestion
- **ai**: learned-facts memory and agent-bound chat persistence
- **ai**: interactive ai-chat island
- **ai**: retrieval-augmented generation (RAG)
- **ai**: persist chat conversations to PostgreSQL
- **ai-chat**: field-level write enforcement for chat mutations (APP-AI-CHAT-MUTATE-008)
- **ai-chat**: implement AI chat record mutations (13/16 APP-AI-CHAT-MUTATE specs + REGRESSION)
- **ai-chat**: implement AI chat rate limiting (APP-AI-CHAT-RATE-001..008 + REGRESSION)
- **ai-chat**: implement AI chat error handling (APP-AI-CHAT-ERROR-001..012 + REGRESSION)
- **ai-chat**: implement AI chat cross-cutting concerns (APP-AI-CHAT-CROSS-001..013 + REGRESSION)
- **ai-chat**: implement AI chat context block (APP-AI-CHAT-CONTEXT-001..010 + REGRESSION)
- **ai-agents**: implement agent tools (APP-AI-AGENT-TOOLS-001..012 + REGRESSION)
- **ai-agents**: implement agent system prompts (APP-AI-AGENT-PROMPT-001..010 + REGRESSION)
- **ai-agents**: implement agent scheduling (APP-AI-AGENT-SCHEDULE-001..008 + REGRESSION)
- **ai-agents**: implement agent permissions (APP-AI-AGENT-PERMS-001..010 + REGRESSION)
- **ai-agents**: implement agent limits (APP-AI-AGENT-LIMITS-001..008 + REGRESSION)
- **ai-agents**: implement agent definition (APP-AI-AGENT-DEF-001..015 + REGRESSION)
- **ai-agents**: implement agent cross-cutting rules (APP-AI-AGENT-CROSS-001..005 + REGRESSION)
- **ai-agents**: implement human-in-the-loop agent approval (AGENT-APPROVAL-001..015 + REGRESSION)

### Bug Fixes

- **forms**: bypass rich-text sanitizer for synthesized formRef markup
- replace regex HTML sanitizer with parser-based sanitize-html
- **security**: gate purge-due endpoint and wire the erasure scheduler
- **ai-chat**: correct escapeRegExp back-reference in shared NL parser

## [0.4.0](https://github.com/sovrium/sovrium/compare/v0.3.0...v0.4.0) (2026-05-14)

### Features

- **escp**: API-AUTOMATION-RUNS-005/006/010 — runs-api replay endpoint + per-run attempt counter; fix CODE-RUN-002/REGRESSION (6-key context)
- **escp**: APP-AUTOMATION-RETRY-003..005 — platform admin email-on-failure notification
- **escp**: APP-AUTOMATION-RETRY-015..017 — webhook deduplication + context.run.attempt + skipped-on-retry
- **escp**: APP-AUTOMATION-RETRY-012..014 — skipped step status + replay endpoint + completed-with-errors run status
- **escp**: APP-AUTOMATION-RETRY-009..011 — exhausted run status + per-attempt history + failure-handler details
- **escp**: APP-AUTOMATION-RETRY-006..008 — per-action + per-run timeout enforcement; new 'timed-out' run status
- **escp**: APP-AUTOMATION-{SAFETY-LOOP,DEFINITION-012/013/015,SAFETY-RATE-002/003,API-AUTOMATION-RUNS-{001,002,003,008,009,012}}-* — infinite-loop detection + concurrency + rate-limit (partial) + runs-API (partial)
- **escp**: APP-AUTOMATION-RETRY-001/002 — automation-level retry: exponential backoff wiring
- **escp**: APP-AUTOMATION-ACTION-FILE-{LIST,GETMETADATA,MOVE,COPY,DELETE,SIGNURL}-* — file:* automation actions (v1+ ops)
- **escp**: APP-AUTOMATION-ACTION-FILE-{PARSECSV,DOWNLOAD,UPLOAD}-* — file:* automation actions (escp-v1: parse-csv, download, upload)
- **escp**: APP-AUTOMATION-ACTION-FLOW-STOP-* + APP-AUTOMATION-ACTION-HTTP-{PUT,PATCH,DELETE}-* — flow:stop + http verbs
- **escp**: APP-AUTOMATION-ACTION-AUTOMATION-{CALL,RETURN}-* + APP-AUTOMATION-TRIGGER-AUTOMATION-{CALL,FAILURE}-* — sub-automations
- **escp**: APP-AUTOMATION-ACTION-{DELAY-WAIT,DELAY-WEBHOOK,DELAY-QUEUE,LOOP-EACH}-* — delay + loop automation actions
- **escp**: APP-AUTOMATION-ACTION-DATA-* — data:* automation action family (set/aggregate/sort/limit/deduplicate/merge/split/compare/lookup)
- **escp**: APP-TABLES-FIELD-AI-GENERATE-* — ai-generate computed field type + ai-*-triggers hub refactor
- **escp**: APP-TABLES-FIELD-AI-SENTIMENT-* — ai-sentiment computed field type
- **escp**: APP-TABLES-FIELD-AI-CATEGORIZE-* — finish the ai-categorize computed-field spec corpus
- **escp**: APP-TABLES-FIELD-AI-SUMMARY-* — finish the ai-summary computed-field spec corpus
- **escp**: APP-TABLES-FIELD-AI-EXTRACT-* — ai-extract computed field type
- **escp**: APP-TABLES-FIELD-AI-TRANSLATE-001..012 — ai-translate computed field type
- **escp**: APP-AI-ECO-ROUTING-001..005 — ECO_AI_PROVIDER_PRECEDENCE AI provider routing
- **escp**: APP-AUTOMATION-ACTION-AI-ERROR-001..005 — ai action runtime-error contract
- **escp**: APP-AUTOMATION-ACTION-AI-EXTRACT-001 — ai:extract automation action
- **escp**: APP-AUTOMATION-ACTION-AI-CLASSIFY-001 — ai:classify automation action
- **escp**: APP-AUTOMATION-ACTION-AI-GENERATE-001 — ai:generate automation action
- **escp**: APP-AI-CONFIG-MISSING-KEY-001..006 — startup fails clearly when AI_PROVIDER set but API key missing
- **escp**: APP-AI-CONFIG-034..037 — common AI parameters (temperature/maxTokens) honored uniformly + startup range validation
- **escp**: APP-AI-CONFIG-001..004 — configure Anthropic Claude via environment variables
- **escp**: APP-AI-CONFIG-039..047 — AI_MODEL string validation at startup + cross-provider warnings
- **escp**: APP-AI-CONFIG-026..029 — AI cleanly disabled when AI_PROVIDER unset
- **escp**: APP-AUTOMATION-ACTION-COMMON-001..004 — per-action retry/continueOnError + cross-step template resolution
- **escp**: APP-AUTOMATION-ACTION-TEMPLATE-001..004 — top-level actions[] reusable templates via $ref
- **tables**: ai-summary compute trigger + per-kind dispatch
- **ai**: add streaming completion to AiService port
- **ai**: add AiService port + Live layer + POST /api/ai/chat
- **pages**: D-4 basic-chart — visx bar chart island [FINAL DRAIN SPEC]
- **notifications**: N-3 email-digests — record-created → email channel
- **pages**: D-3 content-directory-collection — directory-of-md-files generator
- **pages**: D-2 file-based-markdown-content — page.source.file shortcut
- **pages**: D-1 markdown-page-mode — pages[].mode markdown primitive
- **pages**: G-2 gallery-options — masonry/grid + pagination + hover-overlay
- **pages**: G-1 gallery-card-grid — responsive card-grid island
- **pages**: L-3 calendar-interaction — eventClick / dateClick / drag-resize
- **pages**: L-2 event-display — colorField + maxEventsPerDay
- **pages**: L-1 basic-calendar — FullCalendar via React island
- **pages**: E-4 rss-feed-generation — RSS 2.0 feed at /feed.xml
- **pages**: E-3 category-tag-patterns — \$record.* substitution into dataSource.filter
- **pages**: E-2 slug-management — table.unique sugar + auto-slug derivation
- **pages**: E-1 draft-published-status — preview mode + auto-published_at
- **pages**: B-4 dynamic-seo-for-collections — generic deep $record substitution
- **pages**: B-3 collection-pagination-prevnext — adjacency tokens
- **pages**: B-1 collection-page-definition — pages[].mode collection resolver
- **forms**: F-14 one-question-at-a-time — Typeform-style sequential rendering
- **forms**: F-13 multi-step — server-mediated step navigation + draft store
- **forms**: F-12 conditional-logic — visibleWhen/requiredWhen/disabledWhen evaluator
- **forms**: F-11 file-uploads — bucket-backed multipart submit
- **forms**: F-10 onsuccess-and-onerror — runtime IIFE for SSR-only forms
- **forms**: F-9 submission-storage — dual-write transactional ledger lifecycle
- **mcp**: row #38 X-2 client — Sovrium agents as MCP consumers
- **mcp**: row #37 X-1 cross-cutting — independence guarantees
- **mcp**: row #36 M-14 server-internals — full admin metadata surface
- **mcp**: row #35 M-13 server-audit — system.ai_tool_calls audit log
- **mcp**: row #34 M-12 server-rate-limit — sliding-window per-token enforcement
- **mcp**: row #31 M-9 server-actions — action templates as MCP tools
- **mcp**: row #30 M-8 server-automations — manual triggers as MCP tools
- **mcp**: row #29 M-7 server-tables — fieldExposure modes + per-field JSON Schema
- **mcp**: row #28 M-6 server-rbac — RBAC + Z-3 row-level enforcement
- **mcp**: row #27 M-5 server-auth-oauth — Better Auth OAuth bearer
- **mcp**: row #25 M-3 server-transport — stdio + streamable-http
- **mcp**: row #24 M-2 server-discovery — tool annotations + role filtering
- **mcp**: row #23 M-1 keystone — mount /mcp from MCP_ENABLED env var
- **automations**: row #21 record/read action — id-shorthand + filter
- **auth**: add no-config bootstrap-token flow for first-admin claim

### Bug Fixes

- implement APP-PAGES-FORM-031 file type validation for attachment fields
- **forms**: use immutable conditional spread for formAttributes

## [0.3.0](https://github.com/sovrium/sovrium/compare/v0.2.11...v0.3.0) (2026-05-09)

_No user-facing changes in this release._

## [0.2.11](https://github.com/sovrium/sovrium/compare/v0.2.10...v0.2.11) (2026-03-17)

### Bug Fixes

- preserve runtime NODE_ENV detection in production bundle

## [0.2.10](https://github.com/sovrium/sovrium/compare/v0.2.9...v0.2.10) (2026-03-17)

_No user-facing changes in this release._

## [0.2.9](https://github.com/sovrium/sovrium/compare/v0.2.8...v0.2.9) (2026-03-17)

### Features

- add pagination with numbered nav and load-more styles
- add single-record 404 handling and filter/sort query engine
- add session visibility, OAuth social login, and password reset

### Bug Fixes

- resolve CSS compilation deadlock from bundler NODE_ENV inlining

## [0.2.8](https://github.com/sovrium/sovrium/compare/v0.2.7...v0.2.8) (2026-03-17)

### Features

- add production CSS pre-compilation via build command

### Bug Fixes

- suppress CodeQL XSS false positive and fix nodemailer ESLint errors
- defer email config resolution to prevent SMTP error on CLI startup

## [0.2.7](https://github.com/sovrium/sovrium/compare/v0.2.6...v0.2.7) (2026-03-16)

### Features

- wire allowSignUp to Better Auth disableSignUp option
- restrict OpenAPI documentation endpoints to admin users only
- implement page access control for 14 E2E specs (public, auth, role-based)
- implement auth form rendering for login and signup E2E specs (10 tests)
- implement data-table island features for 5 E2E spec files (27 tests)

### Bug Fixes

- resolve 30 broken E2E tests with static build layer and session-aware access control
- resolve sovrium --help failing with "No configuration provided"
- prevent CSS compilation hang on Linux from missing native binaries
- resolve 3 CodeQL security alerts (XSS, open redirect, URL sanitization)

## [0.2.6](https://github.com/sovrium/sovrium/compare/v0.2.5...v0.2.6) (2026-03-16)

_No user-facing changes in this release._

## [0.2.5](https://github.com/sovrium/sovrium/compare/v0.2.4...v0.2.5) (2026-03-16)

### Features

- implement actual DB querying for table data source binding
- implement table data source binding for page sections (APP-PAGES-DATA-001..005)

### Bug Fixes

- resolve package paths correctly when running as npm dependency

## [0.2.4](https://github.com/sovrium/sovrium/compare/v0.2.3...v0.2.4) (2026-03-13)

### Bug Fixes

- resolve drizzle migrations folder relative to package root

## [0.2.3](https://github.com/sovrium/sovrium/compare/v0.2.2...v0.2.3) (2026-03-13)

_No user-facing changes in this release._

## [0.2.2](https://github.com/sovrium/sovrium/compare/v0.2.1...v0.2.2) (2026-03-04)

### Bug Fixes

- resolve Sovrium package version from package root instead of CWD

## [0.2.1](https://github.com/sovrium/sovrium/compare/v0.2.0...v0.2.1) (2026-03-04)

### Bug Fixes

- support shorthand auth strategy format for CLI-LOG-ERROR-003
- import z from @hono/zod-openapi for .openapi() method support
- resolve internal asset paths relative to package root

## [0.2.0](https://github.com/sovrium/sovrium/compare/v0.1.1...v0.2.0) (2026-03-04)

### Bug Fixes

- resolve quality pipeline failures (unit test, knip)

## [0.1.1](https://github.com/sovrium/sovrium/compare/v0.1.0...v0.1.1) (2026-03-04)

### Features

- **api**: expand OpenAPI schema with full REST API routes

### Bug Fixes

- preserve CSS custom properties in style parser
- **website**: strip Prettier whitespace from code blocks in static build

## [0.1.0](https://github.com/sovrium/sovrium/compare/v0.0.2...v0.1.0) (2026-03-03)

_No user-facing changes in this release._

## [0.0.2](https://github.com/sovrium/sovrium/compare/v0.0.1...v0.0.2) (2026-03-03)

_No user-facing changes in this release._
