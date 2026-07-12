## [0.12.1](https://github.com/sovrium/sovrium/compare/v0.12.0...v0.12.1) (2026-07-12)

### Bug Fixes

- **db**: restore released 0000 migration identity, undo illegal squash

### Tests

- **db**: make the PG upgrade-path test opt-in (RUN_PG_MIGRATION_TESTS=1)

### Chores

- regenerate stale generated assets (css utilities + public schema)

### CI

- disable Testcontainers Ryuk in unit tests (socket-proxy blocks its callback)

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
- **admin**: compose bucket file-browser from config data-table + download action + quota kpi (CAP-5 C1)
- **admin**: global-search results surface via named system-source binding (CAP-4)
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
- **partner**: add a Google OAuth2 connection to the partner app
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
- **docs-app**: add admin auth + analytics dashboard page

### Bug Fixes

- **tables**: don't run view-backed id resolution on composite-key tables
- **tables**: correct DEC-048 many-to-many types and clear batch-3 quality drift
- **website**: sync /install script with the canonical install.sh
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
- **partner**: GREEN org-projects backbone specs + hide role-gated embedded formRefs
- **tables**: resolved top custom role bypasses row-level scoping (GAP #1)
- **partner**: repoint temps rowLevelPermissions to project/projects slugs
- clamp cron setTimeout delay to avoid 32-bit overflow busy-loop
- **auth**: route every admin-tier guard through one isAdminTier predicate
- **partner**: declare the Google OAuth env vars in the partner env block
- **connections**: resolve $env.VAR in oauth2 props before the provider flow
- admit custom top-role operators to OpenAPI docs endpoints
- **tables**: make user-preferences + saved-views repos dialect-aware (SQLite 500)
- **admin**: render typed create-form controls in the record grid
- **ai**: make Ollama agent chat work out of the box (no API key)
- **account**: make GDPR self-service export work on the SQLite default
- **build**: stop license script from double-stamping generated CSS assets
- **auth**: exclude agent service users from admin-bootstrap preconditions
- **progress**: recognize directory-based admin API schema modules in coverage check
- **admin**: diff against effective baseline (published-else-booted)
- **progress**: classify fixme-spec'd stories as Specified-Not-Implemented (🟡), not Needs-Specification (🔴)
- **progress**: correct Planned-US spec-ownership heuristic + prototype index Feature Area (clear 7 content warnings)
- **admin-dashboard**: correct forms.spec.ts inline schema to AppSchema form shape
- **security**: tolerate attribute/junk HTML end tags in search-index regexes

### Refactoring

- **partner**: symmetric pain-intensity model — every intensity is a pain_votes note (0d)
- **pages**: hoist contentDir slug derivation into a shared domain util
- delegate comment-grant eval to shared permission helper
- extract helpers to satisfy complexity/statement limits
- **partner**: resilient pain-vote model + view-backed create workarounds
- **partner**: build pain points + demandes collaboration core (batch 2)
- **partner**: repoint pages/forms/auth/app.ts to backbone slugs; neutralize Stripe billing
- **partner**: transform tables to interview-derived backbone (WIP checkpoint)
- **apps**: drop the unused BTN_OUTLINE import from the compare page
- **apps**: reframe pricing around Partner, with Cloud as private beta
- **apps**: collapse the /compare cluster into one honest comparison page
- **apps**: reorient the website home page around community + AI-native
- **apps**: restructure the website header nav + fix the 375px mobile overflow
- **admin**: convert MCP connect panel to static generic config
- **apps**: add the Sovrium Apps community gallery to the website
- **admin**: convert GDPR self-service surface to generic config
- **apps**: delete the standalone apps/docs app
- **admin**: convert users directory to generic system-source data-table
- **apps**: point the footer License/Trademark links at the in-site docs pages
- **apps**: merge docs config zone into apps/website
- **admin**: delete 7 orphaned admin-dashboard islands (-931 LOC)
- **apps**: move docs content + docs-specific public assets into apps/website
- **test**: merge buckets bespoke page + download @regression workflows into one
- **test**: merge gdpr bespoke + converted @regression workflows into one
- **test**: merge overlapping automations-runs @regression workflows into one
- **test**: de-dialect presentational @regression workflows to single postgres run
- **admin**: convert page-analytics surface to generic Sovrium config
- **admin**: dogfood bucket file-browser via generic config
- **admin**: dogfood automation-run detail via record-drawer
- **admin**: render Données record grid via generic data-table
- **admin**: form submissions render via generic data-table + download export + kpi
- **islands**: unify $record url substitution across all fetch-action modes
- **islands**: unify the two CAP-2 system-detail mode predicates
- **islands**: consolidate list-family records fetch + hasDataBinding
- **domain**: lift dataSource.system into shared SystemSourceSchema
- **islands**: share the system-query URL builder across kpi + chart
- **admin**: convert the dashboard overview to config-driven kpi tiles
- **admin**: add a first-class JSON content/code reference-config card to MCP docs
- **admin**: compose API docs from first-class code+tabs component-types
- **admin**: remove the orphaned admin-automation-runs list island
- **data-table**: green the Pass 3A system-source WIP (lint/quality)
- **admin**: redirect bare data object-pages to first item + drop duplicate in-pane rail
- **admin**: derive admin-search use-case types from the canonical API model
- **admin**: drop the /data URL segment from the dashboard (no back-compat)
- **forms**: emit honeypot as static HTML to silence SSR autocomplete warning
- **admin**: remove orphaned Tier 2f per-domain metrics endpoints
- group sprawling route/renderer/island dirs into subdirectories
- **admin**: extract shared time-series bucketing + fix tables-overview layer
- **api**: dedupe admin route guards + add defense-in-depth catch-all
- **db**: consolidate ai-compute trigger generators onto shared hub
- **cli**: drop defunct reload --message flag and dead drift-gate
- **auth**: single admin guard + remove config-search & live migrator
- **db**: drop config version/draft/preview tables + migrations
- **server**: remove orphaned config-mutation callees + config drift
- **admin**: reduce dashboard surface builder to a pure data console
- **admin-sidebar**: collapse to a Data-only navigation sidebar
- **islands**: remove config-editing + observability admin islands
- **server**: remove config-mutation REST schema routes (config code-only)
- **mcp**: remove config-mutation schema tools (config code-only)
- **admin**: remove native config-edition code, MCP server, and versioning
- **admin**: split oversized family-index islands to clear ESLint warnings
- **admin-dashboard**: extract shared Data-page intro + object workspace helpers
- **admin**: clarify why SPA nav events stay off the typed island bus
- **admin**: add stable content-region marker for SPA shell swaps
- **admin**: make admin sidebar navigation-only on every surface
- **admin-dashboard**: collapse duplicated metrics-island primitives
- **presentation**: consolidate Lucide icon resolver into a shared util
- **docs**: hoist MarkdownArticle inline dangerouslySetInnerHTML payloads

### Documentation

- regenerate spec progress after batch-3 merge
- **marketing**: record the executed Scalingo migration in the readiness plan
- **partner**: correct plans-billing @spec count in reconciliation note
- **partner**: reconcile plans-billing + onboarding US to observed config
- **partner**: describe the symmetric pain-intensity model in pain-points US
- **website**: add newsletter section to the privacy policy (EN + FR)
- prettier-format the Scalingo migration runbook
- sovrium.com Scalingo migration discovery + plan, stage runner egress
- **marketing**: add website production-readiness plan
- **marketing**: close the website-checklist campaign (M6 final validation sweep)
- author platform US for m2m-on-create (DEC-048), promote DEC-047 to authored, refresh readTracking JSDoc
- **marketing**: record M5c (edit-this-page shipped, docs-chrome i18n, honest non-adoption)
- **marketing**: record M5b Blocks 1&2 (docs-UX + AI-era markdown-out) + gate plan
- **website**: add troubleshooting page + MCP client-connect walkthrough (M5b Block 3)
- **marketing**: record M5a (P2/P1/P3/P6/P10 closed) + flip checklist
- **partner**: reconcile pain-points + demandes AC/FEATURES to GREEN state
- **partner**: fix stale seed-automation comment in nouveau-pain
- regenerate SPEC-PROGRESS and SPEC-WARNINGS after partner batch 2
- **partner**: update pain-points + demandes US (config paths, model note, blocked ACs)
- **platform**: route comment read/unread, comment-permission, and view-backed-table gaps
- **marketing**: record M4 spec outcome (30/30 GREEN)
- **website**: document the M4 trust & conversion surfaces (newsletter, numbers, BSL, footer)
- **marketing**: record M4 in the website-checklist campaign
- **marketing**: record M3 in the website-checklist campaign
- **platform**: route the last isUnrestricted-parity straggler to a platform US + DEC-044
- **partner**: reconcile org-projects backbone docs with GREEN state
- **marketing**: record M2 in the website-checklist campaign
- **growth**: add Sovrium Partner lead-acquisition system (audit + roadmap + assets)
- regenerate spec progress tracking for partner backbone + platform gaps
- **platform**: route two Sovrium Partner dogfooding gaps to platform US + DEC
- **marketing**: record M1 in the website-checklist campaign
- **growth**: relocate marketing docs under docs/growth/
- **growth**: add Scalezia content corpus for Partner lead-gen research
- **vision**: replace partner FEATURES.md and user stories from the new vision
- **vision**: rewrite partner VISION.md from the founder interview kit
- **marketing**: add professional framework-website checklist
- **vision**: add partner interview 06 recording extraction under 2026-07-11/
- **vision**: add partner interview 05 recording extraction under 2026-07-11/
- **vision**: add partner interview 04 recording extraction under 2026-07-11/
- **vision**: add partner interview 03 recording extraction under 2026-07-10/
- **vision**: add partner interview 02 recording extraction under 2026-07-10/
- **vision**: add partner interview 01 recording extraction under 2026-07-08/
- **vision**: date-scope partner interview answers under 2026-07-06/
- **user-stories**: reconcile website US + FEATURES to shipped Stage-3 reorientation
- close the Admin Dashboard dogfooding campaign (governance + scorecard)
- **progress**: mark the Apps gallery Covered and regenerate SPEC-PROGRESS
- **user-stories**: reconcile the Apps gallery US to shipped Stage-2 reality
- **user-stories**: reconcile the docs zone to Stage 1 of the website merge
- **apps**: rewrite docs internal cross-links to the /docs URL prefix
- **vision**: draft AI-authored answers for the partner business-app interview kit
- **decisions**: record DEC-041 (Merge Docs into Website, Stage 0) + regen SPEC-PROGRESS
- **user-stories**: add the Website-unification user stories + merge FEATURES
- **user-stories**: unify Website VISION and re-home the Docs user stories
- **git-infra**: reconcile docs to reality after Scaleway cost-cutting pass
- resolve content-quality warnings to baseline (1 error + 10 warnings → 0/2)
- **data-table**: add US for the no-match status capability
- **marketing**: add "The Journey" build-in-public content kit
- log DEC-040 (file-upload submission foundation design decision)
- **dev**: update admin-dashboard dogfooding follow-up notes
- **vision**: reorient business-app interview kit to first-person dogfooding
- **memory**: record confirmed GDPR-conversion blocker (session revocation)
- **gdpr**: user stories + DEC-039 for the final two GDPR-conversion gaps
- **vision**: clarify business-app interview order and deconflict §5 north-star
- **decisions**: log DEC-038 — three generic config capabilities for the admin GDPR dogfood
- **user-stories**: add US for confirm-object, session-bound text, and action onSuccess effects
- **dev**: add admin-dashboard dogfooding follow-up vocabulary campaign plan
- **admin**: fix stale recordGridIsland reference in drawer-id comment
- **vision**: remove sample interview transcripts from interview kit
- **website**: prettier-format VISION.md prose reflow
- **website**: reconcile US/VISION to brand-voice reframe (naming, yaml→ts, resolved tensions)
- **vision**: add per-app business-app interview-script kit
- **apps**: correct stale partner template counts in apps/README
- **user-stories**: add per-app vision docs for the four business apps
- **vision**: align interviews table column widths with scripts/ link paths
- **vision**: move interview scripts into scripts/ and repoint their links
- **vision**: remove the vision-consistency-audit ledger and repoint its references
- **vision**: apply Interview-06 brand findings — tagline retirement + voice-contract reversal banner
- **vision**: incorporate answered interviews 05 (customers/JTBD) and 06 (brand/voice)
- **vision**: make docs/vision/ the canonical vision source and reconcile project to it
- **vision**: add interview 11 transcript (large-v3) and mapped answers
- **vision**: add interview 10 transcript (large-v3) and mapped answers
- **vision**: add interview 09 transcript (large-v3) and mapped answers
- **vision**: add interview 08 transcript (large-v3) and mapped answers
- add US for the Développeurs API & MCP docs pages
- **vision**: add interview 07 transcript (large-v3) and mapped answers
- **vision**: add interview 06 transcript (large-v3) and mapped answers
- **progress**: regenerate SPEC-PROGRESS / SPEC-WARNINGS / FEATURES for the Pass 1 batch
- **progress**: regenerate SPEC-PROGRESS after dashboard overview
- **vision**: add interview 05 transcript (large-v3) and mapped answers
- **admin**: add US-ADMIN-FORMS-ANALYTICS + retire dangling metrics-US links
- **vision**: add interview 04 transcript (large-v3) and mapped answers
- **vision**: add interview 03 transcript (large-v3) and mapped answers
- **adr**: record monetization + MCP-scope decisions (free self-host, paid Cloud config-editing)
- **vision**: re-add main's founder-interview scripts + transcripts onto the truth branch
- prune stale config-edition refs after config-code-only removal
- **vision**: upgrade interview 01 transcript to large-v3, recover Q12 opening
- **vision**: add interview 02 transcript (large-v3) and mapped answers
- **vision**: rename reference interview test/ to example/
- regenerate SPEC-PROGRESS.md and drop now-empty SPEC-WARNINGS.md
- add aiAccess YAML example for tables/automations/actions schema coverage
- **vision**: add interview 01 transcript and mapped answers
- drop dangling POST-MVP references after registry removal
- remove POST-MVP deferred-features registry
- **progress**: regenerate SPEC-PROGRESS after R6 dashboard spec verification
- **admin**: reconcile dashboard US AC tables to the pure data console (R6)
- **progress**: regenerate SPEC-PROGRESS after R6 data-console spec reconciliation
- regenerate SPEC-PROGRESS (final)
- drop dangling MCP-server-OAuth consumer ref from oauth-server US/spec
- regenerate SPEC-PROGRESS after residual config-edit cleanup
- scrub stale config-edit cross-references from kept dashboard US
- regenerate SPEC-PROGRESS after config-edition removal
- reframe product contract for config-as-code + data-only admin dashboard
- remove config-edition user stories; reframe dashboard US to data-only
- commit first vision interview transcript; ignore audio
- add founder-interview scripts under docs/vision/
- **vision**: config code-only — admin space is a read-only data console
- **adr**: reverse ADR-020 D2 (free flagship deleted; flag open monetization question)
- **adr**: supersede ADR-021 with ADR-022 (read-only data console, config code-only)
- **admin-dashboard**: re-home the SHELL-SPA US + reconcile indexes; regen SPEC-PROGRESS
- **features**: retire the config-editing feature entries (config code-only)
- **admin-dashboard**: remove the config-editing index/sequencing US
- **agent-memory**: record Data-tab Pass-1 completion + key gotchas
- regenerate SPEC-PROGRESS.md for Data-tab pages
- spec the Data-tab Utilisateurs + Statistiques pages (US)
- add content-only (SPA) navigation ACs to admin dashboard shell US
- correct stale "not built yet" comments in admin dashboard login surface
- **admin-dashboard**: sync user stories, SPEC-PROGRESS + progress artifacts
- **admin-dashboard**: correct stale spawnPreviewServer isolation comment
- **admin-dashboard**: refine readiness US/specs (gdpr, shell, mount, index, FEATURES)
- **admin-dashboard**: re-render prototype for readiness — agents 5-tab (drop Outils), tables no-rows empty state, GDPR self-service
- **admin-dashboard**: readiness fixes — /_admin mount US, agents 5-tab reconcile, GDPR self-service, SHELL gate symbols, doc minors
- **admin-dashboard**: promote tier-b-crud + split monitoring-gaps into 7 spec-backed US (.fixme) + implementation-order
- **admin-dashboard**: promote decided + component US to spec-backed (.fixme specs + AC)
- **admin-dashboard**: sync spec acceptance-criteria status + spec/US updates for the implementation pass
- **admin-dashboard**: v2 Phase 2b-ii part 2 — split-screen, Airtable drawer/views, config-content search, workflow chains
- **admin-dashboard**: v2 Phase 2b-ii part 1 — run search/I-O, dogfood shell, tab consistency
- **admin-dashboard**: v2 Phase 2b-i — family-index, GDPR, agent-chat US + RED specs
- **admin-dashboard**: v2 Phase 2a — extend prototype (list pages, split-screen, Airtable drawer, run I/O, GDPR, agent-chat)
- **admin-dashboard**: v2 Phase 1 — dogfooding ADR-021 + net-new component Planned US
- **docs**: apply Tier-2 voice/parity light fixes
- **admin-dashboard**: resolve F6 (dashboard tiers) + F5 (default-on opt-out)
- **agents**: update scaleway-infra-maintainer DR-strategy memory
- **admin-dashboard**: author Wave D (remaining 9 domains) per-domain US + RED specs
- **admin-dashboard**: author Wave C (forms/buckets/auth) per-domain US + RED specs
- **admin-dashboard**: author Wave B (tables/pages/automations) per-domain US + RED specs
- **admin-dashboard**: author Epic 1 cross-cutting + 1b US + RED specs
- **admin-dashboard**: author platform-gap + Epic 0 foundation US + RED specs
- **admin-dashboard**: add complete visual prototype reference base
- **infra**: remove Tailscale admin fence from sovrium-cloud Caddy
- **sovrium-cloud**: expand resource-limit and OOM-incident notes
- **sovrium-cloud**: document resource limits and OOM incident 2026-06-17
- **docs-app**: update FEATURES and auth user stories
- **adr**: add ADR 020 — monetization (free self-host, paid hosting)
- **infra**: commit canonical sovrium-cloud Caddyfile
- **infra**: add sovrium-cloud app-plane ADR + deploy runbook

### Styles

- fix RSS feed test lint/format and refresh stale generated CSS asset
- prettier-format batch-2 authoring files
- **website**: use text-warmth-fg for the accent eyebrow (WCAG AA)
- **website**: fix header horizontal overflow at 768-1279px (M4 Part A)
- prettier-format partner batch platform-gap docs + spec
- **apps**: align remaining Cloud CTAs to the private-beta waitlist + de-hype
- **docs**: prettier-format the reconciled website FEATURES.md/apps.md
- **apps**: apply Prettier formatting to the apps-gallery config
- apply Prettier formatting across the merged docs zone
- **apps**: make the shared site logo theme-aware for dark mode
- **git-infra**: prettier-format ADR-022 reconciliation docs
- **docs**: prettier-format the dogfood follow-up plan
- **website**: de-echo hero eyebrow (EN + FR)
- **website**: StoryBrand reframe + FR vous→tu reversal (FR marketing)
- **website**: StoryBrand reframe + naming reconcile (EN) — checkpoint
- **docs**: normalize italic markers in interview 06 answers
- **admin**: prettier-format the Pass 2a spec/US + openapi guard files
- **admin**: green the Pass 2a build — format, import-order, regen css assets
- **partner**: French submit labels on the two forms that fell back to "Submit"
- **admin,forms**: polished form defaults, dual version chips, auto-expand nav
- **docs**: prettier-align the global-search FEATURES row
- **admin**: prettier-format admin-search endpoint + repo + port
- **partner**: apply prettier line-wrap to create-qonto-invoice spec
- prettier-format api-schema-structure check in check-progress.ts
- **admin**: polish the pure data console — reshape ⌘K, drop config-editing remnants (R7)
- **docs**: prettier-format vision fundraising script and README table
- prettier-format reframed contract docs
- **admin**: reformat + refresh shell doc-comment for the data console
- **admin-dashboard**: prettier-format the Data-tab US docs
- **admin-dashboard**: lint + format the Data-tab Utilisateurs/Statistiques islands
- prettier-format config-list overhaul specs, stories, and sources
- **admin**: gender-correct French config-list copy + drop dead delete control
- **admin**: cache family-index lists via TanStack Query + loading skeleton
- **admin**: viewport-pinned shell, "Rechercher" placeholder, drop Notifications nav
- **infra**: normalize markdown emphasis in ADR-021 note
- **changelog**: escape markdown asterisks (prettier)

### Tests

- **pages**: assert inline-select refetch end-state instead of racing the GET
- **pages**: assert refetch end-state instead of racing the GET request
- **website**: scope Apps header-entry-point assertion to <nav>
- **partner**: enforce projects.plan required for PLANS-BILLING-002
- **partner**: green catalog (PLANS-BILLING-001) + invitation-gating (ONBOARDING-001/002)
- **partner**: add RED specs for plans-billing + onboarding (batch 3 money)
- **partner**: realign pain-points specs to the symmetric pain-intensity model
- **partner**: green DEMANDES-002 pain-link via m2m-on-create + view-backed fixes (0b/0c)
- add RED fixme specs for m2m-on-create (DEC-048) and view-backed insert (DEC-047)
- **pages**: cover edit-this-page + docs-chrome i18n; guard website non-adoption
- **partner**: green DEMANDES-006 via requests comment readTracking (0a)
- **pages**: add RED specs + US for AI-era per-page markdown export, copy/view, last-updated
- **theming**: fix lint/type nits in the contrast spec
- **partner**: green demandes batch-2 specs (file/kanban/monopoly/comment)
- **partner**: pain-points + demandes collaboration specs, batch 2 (fixme-first)
- **platform**: RED specs for comment permission enforcement and per-user read/unread state
- **website**: cover the dedicated newsletter capture page (M4 Part C)
- **website**: cover footer Newsletter link + pricing BSL license note (M4 C/D)
- **website**: repoint community discuss card to Discussions + cover honest-numbers strip (M4 B2)
- **website**: cover the changelog page + footer/install changelog links (M3)
- **automations**: RED fixme spec for comment-event read-gate top-role parity
- **website**: cover the community and brand pages
- **platform**: add RED fixme specs for the two partner dogfooding gaps
- **website**: cover language switcher, site-wide search, and security/support pages
- **partner**: author org-projects backbone E2E specs (batch 1, fixme-first)
- **e2e**: remove legacy partner specs superseded by the re-derived vision
- **admin**: fix run-retry @regression record-load race under contention
- **specs**: scope docs-landing CTA locators outside the shared nav
- **specs**: align website E2E specs to shipped Stage-3 reorientation
- **admin**: convert MCP docs spec to static-curl contract (RED anchor)
- **specs**: green the Sovrium Apps gallery specs + swap the docs-chrome proxy
- **admin**: converted contract for the RGPD self-service surface
- **specs**: use toHaveCount() in the apps-gallery fixme spec
- **admin**: fix data-users converted-spec bugs; directory conversion GREEN 22/22
- **specs**: migrate the re-homed docs specs onto the unified website app
- **admin**: converted contract for the Utilisateurs directory (data-table + create-form dropped)
- **admin**: regenerate stale darwin responsive baselines for config-driven dashboard
- **specs**: add .fixme() E2E specs for the Website-unification features
- **specs**: re-home docs E2E specs under specs/apps/website/docs/
- **admin**: regenerate analytics @regression baseline for the calm em-dash panel
- **admin**: fix ANALYTICS-005 to assert the calm em-dash, not "0"
- **admin**: restore bespoke users-directory ARIA assertions + park deferred conversion specs
- **data-chart**: add RED spec + schema for chart named empty-state region
- **admin**: align page-analytics spec to the baked-default-window scope
- **data-chart**: add RED specs for configurable chart accessible name
- **admin**: align users-directory ARIA assertions for data-table conversion
- **data-table**: add RED specs for the no-match status capability
- **gdpr**: add RED specs for the final two GDPR-conversion gaps (Phase 2b)
- **pages**: add RED specs for confirm-object, session-bound text, and action onSuccess effects
- **admin**: add RED DOM spec for connections-directory → config data-table conversion
- **action**: add RED spec for FetchAction mode:'oauth' fetch-then-redirect
- **specs**: update system-source-catalog datatable visual baseline
- **specs**: assert resolved request URLs in system/shared-filter data-binding specs
- **cloud**: regenerate darwin visual baselines after data-table restyle
- **admin**: express config-native admin chrome where honest (CAP-5 C3)
- **pages**: add CAP-5 cross-component shared-filter binding (C2)
- **admin**: express the bucket file-browser as composed config (CAP-5 C1)
- **domain**: add CAP-4 system-source catalog + system-search binding
- **admin**: add CAP-3 system operate/mutation action binding
- **pages**: add CAP-2 system detail/single-record binding
- **pages**: add CAP-1 system-source specs for 5 list components
- **admin**: cover the API tabs + MCP reference-config docs composition
- **data-table**: green the system-source binding spec (config + assertions)
- add system data-source binding for data-table + convert automation-runs directory
- add admin oauth2 connect/reconnect/disconnect RED specs + US
- add E2E specs for the Développeurs API & MCP docs pages
- **admin**: co-locate unit tests for the Pass 2a domain utils
- **admin**: lock typed create-form controls + SQLite runtime-views endpoints
- **design-system**: regenerate visual baselines for the polished form/input defaults
- **admin**: regenerate stale dashboard visual baselines after the UX overhaul
- **admin**: fix entity-kind set assertion typing in search schema test
- **admin**: unit tests for the admin global-search response schema
- **admin**: RED specs + index schema + API model for global indexed admin search
- **admin**: spec start-a-new-agent-conversation (Wave 3 M, impl pending)
- **admin**: cover the Application sidebar disclosure expansion (DATA-NAV-012)
- **admin**: regenerate dashboard visual baselines for Wave 2 IA
- **admin**: align dashboard specs with Wave 2 IA (no /data, sidebar toggles, run filters)
- **admin**: regenerate dashboard visual baselines for Wave 1 sidebar regrouping
- **admin**: align dashboard specs with Wave 1 IA + add nav-section coverage
- **admin**: sync admin-data-nav taxonomy test to the 8/8-ready console
- add SHELL-SPA-008 test.step to admin dashboard @regression
- remove config-edition-orphaned fixture helpers
- **admin**: regenerate dashboard visual baselines for the pure data console (R6)
- purge residual config-edit refs from kept specs + fixture
- **admin**: reconcile shell-spa/mount/gdpr + delete auth-endusers (R6)
- **admin**: reconcile Data-tab specs to the pure-data-console (R6)
- **admin**: drop sandbox manual-test fire from automations-runs (preview removed)
- **admin**: trim mixed dashboard specs to data-only; split family-index
- **admin**: reconcile data-nav spec to the Data-only sidebar (R6)
- retire config-mutation specs after data-console removal (R6)
- **admin**: remove config-edition E2E specs coupled to deleted routes
- **api**: retire the app-version-history (version ledger) specs+US
- **api**: drop API-ERRORS-007 (schema/versions 403) from the error-contract sweep
- **api**: retire the schema-edit / MCP-schema-tool / draft-staleness specs+US
- **admin-dashboard**: strip the per-form config dashboard from forms (keep Data inbox)
- **admin-dashboard**: retire the per-object config dashboards
- **admin-dashboard**: retire the config-editing engine + observability specs/US
- **admin-dashboard**: GREEN the Data-tab Utilisateurs + Statistiques specs
- RED specs for Data-tab Utilisateurs + Statistiques pages
- fix DIFF-002 regression step baseline mismatch in config-element-diff
- **admin**: re-seed visual baselines for the rich config-list table
- reconcile config-list diff-baseline + menu-delete spec contradictions
- turn admin Data-tab page specs GREEN (un-fixme + baselines)
- add RED specs for the global Data-tab object pages (records/runs/submissions)
- resolve config-list PART 3 backend specs from hardened directive
- scaffold config-list PART 3 backend capability specs (DRAFT)
- add rich config-list CRUD table UX specs (config-list overhaul)
- retire admin dashboard Notifications surface (not a feature)
- add RED specs for admin dashboard content-only (SPA) navigation
- **admin**: GREEN the reconciled navigation-only sidebar NAV specs
- **docs**: rename navbar spec to match renamed US title (fix US↔spec mapping)
- **cloud**: de-flake RESOURCES-004 with arm-before-poll guard for scale-app
- update snapshot baselines (admin activity, layout tab-panel)
- fix 11 regression specs (docs redesign, better-auth 1.6.19, accordion, editor race)
- **fixtures**: stop ai-mock-server respawn loop on port conflict
- **admin-dashboard**: represent unimplemented specs as test.fixme + revert AC to not-started (honest RED state)

### Chores

- **quality**: regenerate public JSON Schema snapshot + add drift sentinel
- **security**: baseline GHSA-p2fr-6hmx-4528 with unreachability justification
- **website**: expose the changelog as an RSS feed
- regenerate generated-css-assets after batch-2 changes
- **comments**: add opt-in readTracking flag to CommentsConfigSchema
- **website**: newsletter success replaces the form (onSuccess successPage)
- **website**: branded, bilingual custom /404 page with site chrome
- **website**: trust & conversion — newsletter capture, honest numbers, BSL note (M4 B/C/D)
- **website**: add changelog page + release-cadence links
- **website**: add community and brand pages
- **website**: repair header chrome + add security & support pages
- **agents**: encode app-vs-platform spec separation rule
- **website**: M0 website-checklist audit — annotate checklist + 2 config fixes
- **progress**: sync auto-generated progress artifacts
- **memory**: recover unique agent-memory from the dogfood-2 worktree before removal
- **assets**: regenerate embedded runtime assets for the unified website merge
- **memory**: record app-design-finalizer Stage 2/3 website-unification notes
- **memory**: checkpoint agent-memory before dogfood-finish merge
- **memory**: record GDPR surface CONVERTED (supersedes 5 deferral passes)
- **memory**: record the Docs→Website Stage-1 merge completion + gotchas
- **css**: regenerate embedded CSS assets for the merged docs zone
- **apps**: drop the app:docs tooling references ahead of retiring apps/docs
- **memory**: compact e2e-test-fixer index + fold stale-artifact debugging notes
- **memory**: record the US↔spec path-coupling rule for business-app re-homing
- **assets**: regenerate embedded CSS assets
- **progress**: sync auto-generated progress + user-story AC status
- **memory**: record @regression de-dialect + merge pruning rules and validator gotchas
- **memory**: record premature-conversion assertion-flip cleanup + kpi em-dash gotcha
- **memory**: persist Campaign 2 recon + schema-coverage scanner-fix agent notes
- **memory**: record Scaleway storage/observability cost-cutting operation
- **scripts**: fix schema-coverage false positives via structural-fingerprint canonicalization
- **memory**: preserve concurrent-session agent-memory before dogfood merge
- **memory**: record page-analytics surface conversion (deferred → resolved)
- **memory**: record data-table schema.ts-vs-index.ts duplication landmine
- **schema**: sync data-table noMatchMessage onto the page-component union member
- **data-table**: add noMatchMessage for a query-echoing no-match state
- **memory**: record editSelect + form-endpoint runtime patterns + US-naming gotcha
- **memory**: record file-upload submission runtime pattern + gotchas
- **memory**: record file-upload submission foundation gap + gotchas
- **progress**: exclude business-app VISION.md from user-story validation
- add generated SPEC-WARNINGS content-quality report
- **memory**: persist pending agent-memory notes (gdpr/dogfood/fetch caps)
- **memory**: record GDPR Phase-2b RED-isolation patterns + validator gotchas (DEC-039)
- **gdpr**: add pending-erasure read contract + relative-time column format (schema)
- **memory**: record GDPR-foundation runtime gotchas (confirm/session/effects)
- **assets**: regenerate embedded CSS candidate manifest
- **assets**: regenerate embedded-runtime-assets manifest post-dogfood-merge
- **memory**: record gdpr deferral + campaign conversion learnings
- **memory**: record app-design-finalizer website brand/voice reframe
- **memory**: record dogfood conversion + analytics-deferral learnings
- **partner**: add FORM_IP_HASH_SALT to partner env example
- **memory**: record Consoles-as-Config conversion-spec pattern
- **agents**: ground product-specs-architect business-app work in per-app VISION files
- **memory**: record users-directory dogfood = Tier-2 (write-affordance gaps)
- **db**: regenerate embedded static assets for squashed migration baseline
- **db**: squash migration history into fresh single baseline
- **memory**: record dogfood system-datatable conversion gaps (connections Tier-2)
- **memory**: record e2e-test-fixer binary-CSS + drift-gate gotchas
- **assets**: regenerate stale embedded runtime-asset manifest
- **islands**: wrap over-long substituteRecordInComponent call to satisfy Prettier
- **memory**: record CAP-2 record-drawer + page-level system single patterns
- **memory**: record CAP-2 system-detail record-field wiring patterns
- **quality**: clear consoles-as-config quality-gate debt
- **memory**: record CAP-1 system-source list-family wiring patterns
- resolve content-quality backlog to 0 errors / 0 warnings
- **agents**: add Core Product Update Gate to app-design-finalizer
- **memory**: persist pending agent memory
- **assets**: regenerate embedded CSS candidates after docs component-type conversion
- **progress**: regenerate SPEC-PROGRESS/SPEC-WARNINGS for the new oauth-actions specs
- **assets**: regenerate embedded css-asset candidates for Pass 2a
- **assets**: regenerate embedded css-asset candidates for the typed create form
- **assets**: regenerate stale embedded runtime-asset manifest
- **memory**: persist sub-agent memory from the admin dashboard UX overhaul
- **css**: regenerate generated-css-assets to clear embedded-asset drift
- **assets**: regenerate embedded migrations + CSS candidates for admin search
- **agent-memory**: persist app-design-finalizer admin UX wave-1 notes
- **partner**: swap invoicing vendor from Pennylane to Qonto
- **css**: refresh generated-css-assets for Wave 1 admin polish candidates
- **css**: stamp copyright header on generated-css-assets
- **agent-memory**: record isolated-build + generated-assets drift-guard notes
- **build**: isolate binary-build E2E + add generated-assets drift guard
- sync generated embedded/CSS assets + add e2e-test-fixer memory notes
- **agent-memory**: record Effect-diagnostics false-positive determinations
- config-code-only follow-up cleanup + drop POST-MVP registry
- **memory**: app-design-finalizer admin-data console notes + buckets screenshot
- **memory**: update agent memory notes for admin config/data work
- register data-users sidecar spec for US-ADMIN-DASHBOARD-AUTH-ENDUSERS
- **admin**: retire the notifications dashboard surface
- **admin**: regenerate assets and record SPA-nav agent memory
- register shell-spa sidecar spec for US-ADMIN-DASHBOARD-SHELL
- **agents**: require dedicated worktree + surgical scoped specs for app-design-finalizer
- **agents**: make app-design-finalizer pilot the full TDD loop
- regenerate embedded runtime + CSS assets
- **deps**: pin Playwright to 1.60.0 (1.61 ESM-loader regression)
- **knip**: ignore Bun.spawn system binaries flagged by knip 6.17
- **deps**: bump dependencies via bun update + sync version docs
- **agent-memory**: record admin-dashboard implementation landmines
- regenerate SPEC-PROGRESS — admin dashboard fully GREEN (401 ✅)
- **admin-dashboard**: commit in-flight progress regen on main (superseded by classifier+readiness branch)
- regenerate spec progress and remove stray docs preview screenshots
- commit in-flight working-tree changes on main
- **deps**: bump hono 4.12.23→4.12.25 + baseline 5 transitive advisories
- **docs**: tabbed-nav spec rewrite, deploy manifests, config-icon spec
- **admin-dashboard**: format US/specs, regen SPEC-PROGRESS, add docs screenshots
- **assets**: rebuild logo icon kit with full-bleed masked icons
- **agents**: update app-design-finalizer config
- **agents**: extend app-design-finalizer to own native admin dashboard UI/UX

### CI

- **website**: make deploy healthcheck non-blocking on the default-deny runner
- **website**: rework Scalingo deploy to reuse sovrium/bun-buildpack
- **website**: add Scalingo deploy vehicle (buildpack + deploy tree + workflow)
- **release**: set SOVRIUM_ALLOW_DEV_KEY in binary smoke tests

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
- **apps**: drive app:\* previews from per-app .env (auth secret, bootstrap admin, cloud mode)
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
- exclude apps/\*_ from src-layer lint and apps/_/public from prettier
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
