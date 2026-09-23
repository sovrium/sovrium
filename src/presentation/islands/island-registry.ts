/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lazy } from 'react'
// The two design-system preview islands stay STATIC on purpose, against the
// rule the rest of this file now follows. Both render `null` — they enhance
// server-rendered markup rather than owning it — so they add chunk graph but
// almost no bytes, and the frame must be sized before a reader meets it or a
// 40rem box is visibly seen collapsing. See their entries below for the full
// reasoning; it survived both the 2026-09-01 pass that made twelve islands lazy
// and the 2026-09-02 pass that took the last two form islands with them.
import DesignSystemRailIsland from './admin/design-system-rail-island'
import { CalendarIslandLazy, GalleryIslandLazy, KanbanIslandLazy } from './view-type-islands'

/**
 * A module loader for one island — the shape `React.lazy` consumes, so the same
 * loader serves both the priority-preload path and the Suspense path without
 * declaring the `import()` twice. One `import()` expression per island is what
 * keeps Bun emitting one chunk per island.
 */
export type IslandLoader = () => Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Island props vary by type
  readonly default: React.ComponentType<any>
}>

/*
 * ---------------------------------------------------------------------------
 * WHY ALMOST EVERY ISLAND BELOW IS BEHIND `import()` — AND WHY TWO ARE NOT
 * ---------------------------------------------------------------------------
 *
 * There is exactly ONE island entry module for the whole app, and a browser
 * fetches an ES module's entire STATIC import closure before evaluating a line
 * of it. So `import X from './x-island'` here was never "eager for pages that
 * mount X" — it was eager for EVERY page that mounts ANY island.
 *
 * Measured by `[internal ref]` against the real
 * `buildRuntimeAssets`, over the three shapes this file has had:
 *
 *     14 static (before 2026-09-01)       49 chunks   784.0 KB
 *      2 static (2026-09-01)              17 chunks   566.0 KB
 *      0 static (2026-09-02, this shape)   6 chunks   233.1 KB
 *
 * The third row was a PROBE when the second shipped — "~230 KB, not shipped",
 * because nothing could hold the timing guarantee the two static imports were
 * paying for. It ships now, and it landed within 3 KB of the probe.
 *
 * A page mounting one `tabs` and a page mounting one `accordion` fetched the
 * byte-identical set, because the set never depended on the page. It still does
 * not — the point of this change is that the fixed set is now much smaller, not
 * that it became page-specific.
 *
 * The trap that had kept this in place: removing any ONE of the 14 static
 * imports saved nothing. Measured per island, the saving ranged from -603 to
 * +5,865 bytes — noise — because those 14 share Base UI, react-hook-form, zod
 * and floating-ui, so whichever ones remain hold the whole library set in the
 * closure anyway. Nothing improves until a whole cluster moves at once, which is
 * why this was taken in one step rather than island by island.
 *
 * WHAT REPLACES "EAGER" FOR THE URGENT ISLANDS
 * --------------------------------------------
 * Several islands genuinely must be MOUNTED before the first interaction: until
 * React takes over, the SSR skeleton owns the events, so a form that submits
 * natively, a file input that swallows `setInputFiles`, or a tab strip with no
 * `tablist` role are real regressions — each recorded on its `ISLANDS` line.
 *
 * A static import is one way to guarantee that, and an expensive one. What most
 * of those islands need is *"resolved before `mountIslandsWithin` runs"*, not
 * *"in the entry's static closure"*. {@link PRIORITY_ISLAND_LOADERS} names
 * them; `preloadIslandsWithin` (island-client.tsx) awaits the loaders for the
 * marker types PRESENT IN THE DOM, and the mount pass then commits them
 * synchronously through `flushSync` exactly as before.
 *
 * WHY `crud-form` AND `auth-form` NEED MORE THAN THE RUNTIME PRELOAD
 * -----------------------------------------------------------------
 * The runtime pass buys "resolved before the mount pass", NOT "resolved before
 * the `load` event". Measured: a deferred module script's top-level `await` does
 * not hold back `load`, so a marker whose chunk is fetched during that await
 * mounts shortly AFTER `load` — and `page.goto()` resolves on `load`.
 *
 * For most islands that is harmless: Playwright's actionability polling and a
 * one-chunk fetch overlap. For the crud-form it is not, and the failure is
 * silent rather than loud. The crud-form's chunk pulls a SUB-GRAPH
 * (react-hook-form, zod, the field renderers), so its load is several round
 * trips rather than one, and it loses the race CONSISTENTLY rather than
 * occasionally: `setInputFiles` lands on the SSR `<input type="file">`, React
 * re-renders the field, the file is gone, the island's size/type validation
 * never runs, and the form renders perfectly while doing the wrong thing.
 *
 * Re-measured 2026-09-02 by mutation — the links emitted, then suppressed, on an
 * otherwise identical tree: 17/17 with them, **7/17 with them removed**. The ten
 * failures are in `[internal ref]`.
 *
 * What closes it is an SSR-emitted `<link rel="modulepreload">` in `<head>` for
 * the island types the page declares, so the chunk fetch starts at HTML-PARSE
 * time beside the entry instead of behind it. The island-type -> chunk map that
 * needs lives in `@/infrastructure/assets/island-preload-manifest`, which also
 * documents why the map is COMPUTED from the emitted bundle rather than written
 * down, and why it covers these two island types and no others.
 *
 * Two consequences for anyone editing this file. Renaming an island MODULE can
 * change its emitted chunk name and silently orphan a manifest entry — the
 * manifest logs an error and the specs above go red, which is the intended
 * failure. And a preloaded island's module must resolve to a UNIQUELY-named
 * file: `crud-form-island/index.tsx` emitted `index-<hash>.js`, one of three
 * such chunks, which is why it is now `crud-form-island/crud-form-island.tsx`.
 *
 * ONE HAZARD THAT COSTS A WHOLE SURFACE
 * -------------------------------------
 * `island-client.tsx` bootstraps with a TOP-LEVEL `await`. A module reached
 * from a PRIORITY loader must therefore never STATICALLY import
 * `@/presentation/islands/island-client`: that closes an ES-module cycle across
 * a pending top-level await, which deadlocks. It throws nothing and logs
 * nothing — the surface simply renders with no island mounted, reading as
 * "the sidebar is missing" rather than as an import problem. It cost 10 of the
 * 10 `[internal ref]` specs before
 * `admin-spa-nav-swap.ts` was moved to a dynamic `import()`, which is also why
 * `tabs-island.tsx` has always reached the mounter that way.
 *
 * To add a new island type:
 * 1. Create the component in src/presentation/islands/
 * 2. Declare a loader below and add an `ISLANDS` entry (`lazy(loadX)`)
 * 3. Add it to PRIORITY_ISLAND_LOADERS *only* if it must own its events before
 *    the first interaction — and name that interaction in a comment. If its
 *    module needs the mounter, reach it with `import()`, never a static import.
 * 4. Add the SSR placeholder in island-components.tsx
 */

const loadAdminAgentConversations = () => import('./admin/agents/admin-agent-conversations-island')
const loadAdminCommandPalette = () => import('./admin/command-palette/admin-command-palette-island')
const loadAdminSpaNav = () => import('./admin/spa-nav/admin-spa-nav-island')
const loadAiChat = () => import('./ai-chat-island')
const loadAuthForm = () => import('./auth-form/auth-form-island')
const loadCrudForm = () => import('./crud-form-island/crud-form-island')
const loadDatePicker = () => import('./date-picker/date-picker-island')
const loadTabs = () => import('./disclosure/tabs-island')
const loadFileUpload = () => import('./file-upload/file-upload-island')
const loadNumberInput = () => import('./form-controls/number-input-island')
const loadSplitPane = () => import('./split-pane-island')
const loadSidebarGroups = () => import('./navigation/sidebar-groups-island')
const loadSidebarBadge = () => import('./navigation/sidebar-badge-island')
const loadSidebarDisclosure = () => import('./navigation/sidebar-disclosure-island')
const loadSidebarCurrent = () => import('./navigation/sidebar-current-island')
const loadRecordPicker = () => import('./parts/record-picker/record-picker-island')
const loadRecordDrawer = () => import('./overlays/record-drawer-island')
const loadPageRecordSystem = () => import('./page-record-system-island')

/**
 * Islands that must be RESOLVED before the mount pass, keyed exactly as in
 * {@link ISLANDS}.
 *
 * `preloadIslandsWithin` awaits only the entries whose `data-island` marker is
 * actually in the subtree being mounted, so a page pays for the urgency of the
 * islands it declares and for nothing else.
 *
 * Membership is a claim about EVENT OWNERSHIP, not about importance: an island
 * belongs here when the SSR skeleton would otherwise handle the user's — or the
 * spec's — first gesture. Every entry below was a static import before
 * 2026-09-01 and keeps the identical guarantee; the reason is on its `ISLANDS`
 * line.
 */
export const PRIORITY_ISLAND_LOADERS: Readonly<Record<string, IslandLoader>> = {
  'split-pane': loadSplitPane,
  'page-record-system': loadPageRecordSystem,
  'ai-chat': loadAiChat,
  tabs: loadTabs,
  // The FIRST gesture on a sidebar disclosure is the click that opens it, and
  // the SSR button it lands on carries no handler — so a toggle that mounts one
  // Suspense boundary later silently swallows it. Same reason as `tabs`, whose
  // panel switch is the same control in a different shape.
  'sidebar-disclosure': loadSidebarDisclosure,
  // A swapper may announce its navigation before a lazily-resolved island has
  // mounted, and that announcement is the ONLY event ever sent for that move —
  // miss it and the mark is stale for the rest of the session.
  'sidebar-current': loadSidebarCurrent,
  'record-drawer': loadRecordDrawer,
  'admin-spa-nav': loadAdminSpaNav,
  'command-palette': loadAdminCommandPalette,
  'admin-agent-conversations': loadAdminAgentConversations,
  'file-upload': loadFileUpload,
  'number-input': loadNumberInput,
  'date-picker': loadDatePicker,
  // The FIRST gesture on a picker is the click that opens its suggestions, and
  // the SSR skeleton it lands on is an inert, disabled box carrying no handler
  // — so a picker that mounts one Suspense boundary later swallows that click
  // and reads as a search box that finds nothing.
  'record-picker': loadRecordPicker,
  'auth-form': loadAuthForm,
  'crud-form': loadCrudForm,
}

/**
 * Island component registry — maps island type names to React components.
 *
 * Every value is a `React.lazy`, which is the mount-time FALLBACK: for a type in
 * {@link PRIORITY_ISLAND_LOADERS} whose loader `preloadIslandsWithin` has
 * already awaited, the mounter uses the resolved component and never reaches
 * this map's Suspense path. The `lazy` wrapper still matters for those types —
 * it is what a LATER scan falls back to (a tabs panel committing its markers, an
 * admin SPA content swap), so a marker discovered after the preload pass mounts
 * rather than being dropped.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Island props vary by type
export const ISLANDS: Record<string, React.ComponentType<any>> = {
  // The registry key follows the component TYPE (`table`), while the island's
  // own directory keeps its `data-table` name — the payload ceilings are
  // file-keyed, so renaming the directory would silently reset every one of
  // them. `check-island-drift.ts` asserts `ISLAND_COMPONENT_TYPES ⊆ ISLANDS`,
  // which is what forces the key and not the path.
  table: lazy(() => import('./data-table/island')),
  // `split-pane` — resizable two-pane layout enhancement island. Renders
  // nothing; wires pointer-drag onto the SSR-rendered static structure so the
  // nested islands inside each pane survive hydration
  //. PRIORITY (same timing
  // constraint as file-upload / number-input): the drag must be wired before
  // the user (or the spec) drags the divider, so it cannot wait for a Suspense
  // fallback to resolve.
  'split-pane': lazy(loadSplitPane),
  // The three view-type islands are bound ONCE in `view-type-islands.ts`,
  // because the data-table's view switcher renders the SAME lazy components
  // when it swaps the grid out. One binding keeps both consumers on one chunk
  // per view type (and keeps all three off the universal island payload).
  kanban: KanbanIslandLazy,
  calendar: CalendarIslandLazy,
  gallery: GalleryIslandLazy,
  chart: lazy(() => import('./chart/chart-island')),
  // `graph` — the Map lens' drawing. Lazy (eco R2), and unusually CHEAP for a
  // drawing: it fetches nothing (the render path already read the endpoint with
  // the caller's credentials and handed the projection across as props) and it
  // takes no charting library — the layout is arithmetic and the only third-
  // party code in its closure is one bezier path generator.
  graph: lazy(() => import('./graph/graph-island')),
  kpi: lazy(() => import('./kpi/kpi-island')),
  // Registry key `timeline`, island FILE still `timeline/timeline-island.tsx`.
  // The key follows the component type (which absorbed `data-timeline`) so the
  // gate needs no spelling translation; file names are load-bearing for the
  // payload ceilings and never move.
  timeline: lazy(() => import('./timeline/timeline-island')),
  // `list` (CAP-1) — a list with `listDisplay.itemTemplate` + a `dataSource`
  // (DB table OR system read endpoint) renders its items CLIENT-side via this
  // island. The search-mode list keeps the separate `search-list` island below.
  list: lazy(() => import('./list/list-island')),
  // `sidebar-groups` — the FETCHED half of a `sidebar` group: one entry per row
  // of a rows envelope. The group heading and its authored entries are
  // server-rendered and sit above this host, so navigation works without
  // JavaScript and this island carries only a fetch and a list. Lazy (eco R2).
  'sidebar-groups': lazy(loadSidebarGroups),
  // `sidebar-badge` — the live count beside an authored sidebar entry. The
  // other branch of `badge` is a literal, which the server renders and this
  // island never sees; a COUNT is stale the moment a config states it, so it is
  // read from an endpoint. Its own island rather than a mode of `sidebar-groups`
  // because it mounts INSIDE a server-rendered entry rather than replacing a
  // group's fetched half. Lazy (eco R2) — a fetch and a number.
  'sidebar-badge': lazy(loadSidebarBadge),
  // `sidebar-disclosure` — the toggle and the child list of an EXPANDABLE entry.
  // The entry's own link stays server-rendered beside this host, icon and badge
  // island included, so the destination never waits on a chunk; the island owns
  // only what cannot work without JavaScript. Its host carries
  // `display: contents`, so the button and list land in the row's grid as
  // though no wrapper existed. Lazy (eco R2).
  'sidebar-disclosure': lazy(loadSidebarDisclosure),
  // `sidebar-current` — re-derives `aria-current` on the SERVER-rendered entries
  // after a same-document navigation. Renders nothing: the entries carry inline
  // icons and may host badge islands, so re-rendering them to change one
  // attribute would ship the icon set to the browser. Mounted only when the
  // sidebar declares `trackNavigation`. Lazy (eco R2).
  'sidebar-current': lazy(loadSidebarCurrent),
  // `record-field-system` (CAP-2) — a `record-field` with its OWN
  // `dataSource.system` SELF-binds to a system DETAIL endpoint: it fetches ONE
  // record (the route id injected into the `:param` slot) and renders `props.field`
  // CLIENT-side. A record-field WITHOUT a dataSource keeps inheriting from its
  // container server-side (the SSR path), so this island only mounts for the
  // self-binding system variant. Lazy-loaded (eco R2) — tiny fetch-and-render.
  'record-field-system': lazy(() => import('./record-field-system-island')),
  // `page-record-system` (CAP-2) — a PAGE whose page-level `dataSource.system`
  // binds it to ONE record from a system DETAIL endpoint. A pure side-effect
  // enhancer: it fetches the detail record and distributes `$record.*` into the
  // SSR page text nodes in place (renders nothing). PRIORITY so the fetch fires
  // on the mount pass rather than a Suspense boundary later.
  'page-record-system': lazy(loadPageRecordSystem),
  // `api-key-manager` — the whole `/_admin/api-keys` surface: the operator's own
  // keys, the mint affordance, the show-once reveal (F1) and the revoke gate.
  // Lazy (eco R2): only one console surface ever mounts it.
  'api-key-manager': lazy(() => import('./api-keys/api-key-manager-island')),
  'search-list': lazy(() => import('./search/search-list-island')),

  // The four kit-addition islands. One `import()` each, which is what keeps Bun
  // emitting one chunk per island — and what lets the payload budget hold each
  // to its own ceiling rather than to a shared one calibrated on the largest.
  //
  // The two editors are deliberately SMALL: each owns its value and defers to
  // the existing field editor's chunk, so the ~848 KB of Tiptap and the ~428 KB
  // of CodeMirror stay on the far side of a second split point and are paid
  // only by a page that actually mounts one.
  'rich-text-editor': lazy(() => import('./rich-text-editor-island')),
  'code-editor': lazy(() => import('./code-editor-island')),
  'date-range-picker': lazy(() => import('./date-range-picker/date-range-picker-island')),
  'filter-bar': lazy(() => import('./filter-bar/filter-bar-island')),
  // The last two static imports in this file, moved 2026-09-02. PRIORITY like the
  // rest, but ALSO the only two island types carrying an SSR-emitted
  // `<link rel="modulepreload">` — the runtime preload alone loses their race
  // against `load` (the header block has the mutation measurement). Their entry
  // in `PRELOADED_ISLAND_CHUNK_NAMES`
  // (`@/infrastructure/assets/island-preload-manifest`) is what makes them safe
  // to be lazy at all; deleting it silently restores the form that renders
  // perfectly and drops the uploaded file.
  'auth-form': lazy(loadAuthForm),
  'crud-form': lazy(loadCrudForm),
  // PRIORITY so the island mounts on the mount pass, taking over the input row
  // before the user can type into the SSR skeleton.
  'ai-chat': lazy(loadAiChat),

  // Base UI islands (lazy-loaded, code-split per component)
  // Phase 0
  dialog: lazy(() => import('./overlays/dialog-island')),
  'alert-dialog': lazy(() => import('./overlays/dialog-island')),
  // Phase 1 — Form Controls & Core
  select: lazy(() => import('./select/select-island')),
  // (The `dropdown` key — a "legacy alias for select" — was DELETED, not
  // exempted. Nothing in `src/` emitted `data-island="dropdown"` (only
  // `dropdown-menu`, a different island), and commit 9ea2b7832 had already
  // removed its COMPONENT_REGISTRY renderer, so it was unreachable from both
  // ends. `mountIslandsWithin` (island-client.tsx:143) is the ONLY mount path
  // and it keys strictly off this object, so no honest exemption could be
  // written for it. Enforced by `[internal ref]`.)
  accordion: lazy(() => import('./disclosure/accordion-island')),
  // `tabs` — PRIORITY. The per-domain admin dashboards (tables / pages /
  // automations) make the 4-tab frame their PRIMARY content and the specs
  // interact with the tablist immediately after `page.goto` (assert the active
  // tab, click a tab). Left on the Suspense path, the SSR tab skeleton (no
  // `tablist` role) survives past the first assertion under worker contention,
  // so the tabs island must be resolved before the mount pass — same "wire
  // before first interaction" rationale as record-drawer / crud-form /
  // split-pane.
  tabs: lazy(loadTabs),
  checkbox: lazy(() => import('./form-controls/checkbox-island')),
  'radio-group': lazy(() => import('./form-controls/radio-island')),
  switch: lazy(() => import('./form-controls/switch-island')),
  // Phase 2 — Overlays & Feedback
  tooltip: lazy(() => import('./overlays/tooltip-island')),
  popover: lazy(() => import('./overlays/popover-island')),
  'hover-card': lazy(() => import('./overlays/hover-card-island')),
  drawer: lazy(() => import('./overlays/drawer-island')),
  // `record-drawer` — record-detail/edit drawer specialization
  //. PRIORITY so its
  // `sovrium:open-drawer` listener is wired before a data-table row click can
  // fire (the dispatch arrives synchronously on click); a Suspense fallback
  // would miss the first event.
  'record-drawer': lazy(loadRecordDrawer),
  'dropdown-menu': lazy(() => import('./overlays/menu-island')),
  'context-menu': lazy(() => import('./overlays/menu-island')), // Shares menu island
  // `record-picker` — the UNBOUND picker. Lazy: it costs a search
  // hook and a listbox, and a page that declares none should pay for neither.
  'record-picker': lazy(loadRecordPicker),
  slider: lazy(() => import('./form-controls/slider-island')),
  toggle: lazy(() => import('./form-controls/toggle-island')),
  'toggle-group': lazy(() => import('./form-controls/toggle-group-island')),
  // Phase 3 — Navigation & Advanced
  menubar: lazy(() => import('./overlays/menubar-island')),
  'navigation-menu': lazy(() => import('./overlays/nav-menu-island')),
  'scroll-area': lazy(() => import('./overlays/scroll-area-island')),
  // Wave-6 — page-level presence awareness. Mounted by `DynamicPage` on every
  // page configured with `presence: true` (not a schema-authored component).
  'presence-indicator': lazy(() => import('./presence-indicator-island')),
  // NOTE: the `admin-record-grid` bespoke island was retired ([internal ref] dogfood) —
  // the Données surface now renders the record
  // grid via the GENERIC `table` component bound to the operator table by
  // its DB-table data source (`dataSource.table`), reusing the data-table's
  // record CRUD + typed create modal + `onRowClick: openDrawer` (see
  // `table-data-surface.ts`) instead of a one-off admin island.
  // NOTE: the `admin-overview` bespoke island was retired — the dashboard ROOT
  // "Tableau de bord" overview is now built from the
  // GENERIC `kpi` component bound to `GET /api/admin/overview` via the
  // `dataSource.system` value-path binding (see `overview-surface.ts`), dogfooding
  // Sovrium's own data components instead of a one-off admin island.
  // (The run-DETAIL pane is no longer a bespoke island: the converted
  // automation-runs directory now opens the GENERIC `record-drawer` over
  // `dataSource.system` from its action column — see the Automations preset page.
  // The `admin-automation-runs-detail` + `-retry` islands were dropped.)
  // NOTE: `shared-filter-select` is GONE. It was the automation + status
  // publisher for the runs directory, and its whole job was to dispatch one
  // `island:system-query` event. `select.publishes` is that
  // dispatch as a declaration, bound by the global vanilla runtime, so the
  // Automations page now expresses the same filter bar with no hydration at all
  // — see `src/admin/config/pages/data/automations.ts`.
  // NOTE: the FORMS Données surface (`admin-form-submissions` + `admin-form-metrics`)
  // was DROPPED in the [internal ref] dogfood pass — the Soumissions page now renders via
  // GENERIC components (a `table` system source for the list, a `kpi` system
  // source for the metric, a `fetch`/`download` action for the CSV export, and a
  // system-detail `record-drawer` for the per-submission drill-down). See
  // `src/admin/config/pages/data/forms.ts` — the builder this used to point at
  // was deleted with the rest of `dashboard-surfaces/` when the console became
  // config.
  // NOTE: the RGPD Données & RGPD surface (`admin-gdpr`) was DROPPED in the [internal ref]
  // dogfood pass — the Mon compte page now renders via GENERIC config (a
  // session-bound `text` identity, `mode: download` / confirm-gated `fetch` action
  // buttons with a persistent `onSuccess.status`, and a system-source `table`
  // for the pending erasure). See `src/admin/config/pages/gdpr.ts` — same
  // deletion as the note above.
  // `admin-mcp-connect` — the MCP "Connecter votre IA" island was RETIRED in the
  // [internal ref] dogfood pass. The `/_admin/mcp` MCP page now renders via GENERIC config:
  // a static `content/code` endpoint reference + an "Émettre un identifiant"
  // RFC-7591 register curl (`POST /api/auth/oauth2/register`, fully curl-usable) +
  // the static "Configuration de référence" Claude-wiring card. Accepted loss:
  // one-click credential copy and the live status pill — the origin is no longer
  // a loss, since the page resolves it server-side from `/api/admin/instance`.
  // See `src/admin/config/pages/developers/mcp.ts`.
  // (The Data-tab Utilisateurs page — [internal ref] — is now
  // composed from GENERIC Sovrium config: a `kpi` strip + a system-bound
  // `table` over `GET /api/admin/users`, with the row gestures rewired onto
  // config `fetch` actions. The bespoke `admin-users-directory` island + its
  // `EndUserRow` / `MetricCard` / `AddUserForm` helpers were retired in the
  // Consoles-as-Config conversion — see `data-users-surface.ts`.)
  // (The Data-tab Statistiques page — [internal ref] — is now
  // composed from GENERIC Sovrium config: a `kpi` strip + a system-bound `chart`
  // + a system-bound `table` over the page-view analytics backend. The
  // former bespoke per-analytics island was retired in the dogfooding conversion,
  // so it no longer needs a registry entry.)
  // `admin-spa-nav` — Native Admin Dashboard content-only (SPA) navigation
  //. Renders nothing; intercepts left-clicks on
  // `/_admin/*` links and swaps ONLY the `#admin-surface-content` region via a
  // content-only partial fetch (keeping the persistent sidebar + ⌘K palette
  // mounted), routes ⌘K palette selections through the same swap path, handles
  // back/forward via popstate, and falls back to a full nav on a non-OK partial.
  // PRIORITY so the global click interceptor is live before the first nav
  // click. Mounted via a `data-island` marker in the shell chrome (outside the
  // swap region so its listeners survive content swaps).
  'admin-spa-nav': lazy(loadAdminSpaNav),
  // `command-palette` — the ⌘K search overlay a `command-palette` component in
  // SEARCH mode hosts ([internal ref],
  // [internal ref]). Its binding arrives as props: `endpoint`
  // (queried per keystroke with `?q=`), `placeholder`, and `kindLabels` for the
  // group headings — the console's own values are the defaults, which is what
  // let the admin palette become this generic island without a behaviour change.
  // `⌘K` / `Ctrl+K` (and a `data-command-palette-trigger` click) open the
  // dialog; selecting a result deep-links to the match. PRIORITY so the
  // open-intent listener is wired before the first keypress; it renders null
  // until opened.
  'command-palette': lazy(loadAdminCommandPalette),
  // (The `admin-bucket-metrics` + `admin-bucket-files` bespoke islands were retired:
  // the `/_admin/buckets/:name` file browser is now a generic config surface —
  // a quota `kpi`, an upload `file-upload`, and a file `table` bound via
  // `dataSource.system` to `GET /api/admin/buckets/:name/files` with a CAP-3
  // `mode: download` per-row action. See `data-buckets-surface.ts`.)
  // `admin-agent-conversations` — Native Admin Dashboard agents Données surface
  //. The ChatGPT-style read-only conversation
  // viewer: a conversation list (`GET /api/admin/agents/:name/conversations`) +
  // the selected conversation's message thread (`.../conversations/:id`).
  // PRIORITY: the viewer is the surface's primary content, so the specs read it
  // straight after `page.goto`. Mounted via a `data-island` marker on a generic
  // container.
  'admin-agent-conversations': lazy(loadAdminAgentConversations),
  // (`design-system-share` used to sit here — the mint / revoke affordance on
  // `/_admin/design-system`, [internal ref] amendment A3 Part 2. It is GONE rather
  // than moved: the panel is now declared as CONFIGURATION in
  // `src/admin/config/pages/design-system/overview.ts`, where the listing is a
  // rows binding and mint/revoke are buttons with fetch actions, so nothing
  // emits its `data-island` marker any more. The entry outlived that swap and
  // kept a lazy chunk in the build no rendered page could mount. The API it
  // spoke to is unchanged, still gated, and still specced.)
  // The two halves of the preview channel (`[internal ref]`, `-055`).
  // Both are pure enhancers rendering `null`, in the `split-pane` mould: the
  // console-side one drives the SSR-rendered iframe rather than rendering it,
  // because an island that owned the `<iframe>` would re-create it on hydration
  // and load the whole preview a second time. EAGER, unlike the two lazy
  // design-system islands above: the frame must be sized before the reader
  // meets it, and a lazily-resolved chunk would leave a 40rem box on screen
  // long enough to be seen collapsing. Both render nothing, so the eager cost
  // is eco-negligible.
  'design-system-rail': DesignSystemRailIsland,
  // (The `admin-connections-directory` bespoke island was retired: the
  // `/_admin/connections` directory is now a generic config `table` bound via
  // `dataSource.system` to `GET /api/admin/connections` — see
  // `data-connections-surface.ts`, the flagship Consoles-as-Config conversion.)
  // File-upload (dropzone variant) — wires client-side size/count validation
  // on top of the SSR placeholder rendered by `renderFileUpload`. PRIORITY so
  // the React handler takes over BEFORE the test (or user) calls
  // `setInputFiles` on the SSR placeholder's <input>; on the Suspense path the
  // SSR input handles the change event and the validation island never sees
  // the file. Only mounted when the schema sets `dropZone: true` (see
  // interactive-components.ts).
  'file-upload': lazy(loadFileUpload),
  // Number-input — adds explicit `+` / `-` stepper buttons and on-blur
  // min/max value clamping on top of the native `<input type="number">`
  // (which gives us `role="spinbutton"` + ArrowUp/ArrowDown for free).
  // PRIORITY for the same reason as file-upload: the test (or user) typically
  // interacts immediately after `page.goto(...)`.
  'number-input': lazy(loadNumberInput),
  // Date-picker — composes a popover trigger with a react-day-picker
  // calendar grid. Supports `single` / `range` selection modes and
  // `minDate` / `maxDate` constraints. PRIORITY so the trigger button takes
  // over before the test interacts.
  'date-picker': lazy(loadDatePicker),
  // Page-search — wires the build-time TF-IDF index (under
  // `/sovrium-search/index.json`) to a live results panel. Lazy-loaded so
  // the chunk is only fetched on pages that actually carry a `pageSearch`
  // component.
  // Registry key `search-input`, island FILE still `page-search-island.tsx`.
  // The key follows the component type (which absorbed `pageSearch` and
  // `searchInput`) so the gate needs no spelling translation; the file name is
  // load-bearing for the payload ceilings and never moves.
  'search-input': lazy(() => import('./search/page-search-island')),
  // Comment thread + count (PG-01 / PG-02). The comment-count island
  // fetches the total from the existing comments-API pagination metadata;
  // the comment-thread island hydrates the section with the paged list,
  // authenticated form, edit/delete affordances, sort dropdown, and
  // load-more / numbered pagination. Both lazy-imported — no eager-timing
  // constraint (the SSR skeleton's `<p data-comments-empty-state>` /
  // SSR-rendered count label is the user-visible fallback until hydration).
  comments: lazy(() => import('./comments/comment-thread-island')),
  'comment-count': lazy(() => import('./comments/comment-count-island')),
}

/**
 * The `rich-text` inline cell editor for the data-table grid.
 *
 * This module owns most of the island tree's dynamic imports, but not all of
 * them: the crud-form's own deferred `code` and `rich-text` fields declare
 * theirs next to their consumers, because a loader here would have to be
 * imported BACK by the crud-form island, which this file loads. Every dynamic
 * edge that is not reached through another island's own module belongs here;
 * the crud-form's two cannot.
 *
 * Tiptap is the largest single dependency any island pulls, so declaring this
 * edge is what lets a grid whose columns are all text/number/date skip an
 * editor it never opens (ecoconception R2). The chunk is fetched on the first
 * double-click into a `rich-text` cell — and, since the crud-form's rich-text
 * field now resolves the same underlying module, a page with both a grid and a
 * form downloads it once.
 *
 * Two deliberate departures from its siblings above:
 *
 * 1. It is NOT an entry in {@link ISLANDS}. That record is the `data-island`
 *    MARKER map — `mountIslandsWithin` builds those components' props by
 *    `JSON.parse`ing a `data-island-props` attribute. A cell editor's props are
 *    callbacks (`commit`, `cancel`, `tabNext`), which JSON cannot carry, so a
 *    marker entry would advertise a mount contract that throws the moment
 *    anyone used it. The grid imports this loader directly.
 *
 * 2. It is a plain loader, not `React.lazy` — Tiptap cannot survive Suspense.
 *    The mechanism, and why moving a `<Suspense>` boundary closer to the editor
 *    does not help, is documented once on `useDeferredComponent`
 *    (`components/deferred-component.ts`), which every deferred editor uses.
 */
export const loadRichTextCellEditor = () =>
  import('./data-table/editors/rich-text-editor').then((m) => m.default)

/**
 * The grid's `code` cell editor, on the same terms as the rich-text one above:
 * not an {@link ISLANDS} entry (its props are callbacks, which a
 * `data-island-props` attribute cannot carry), and fetched on the first
 * double-click into a `code` cell.
 *
 * CodeMirror plus its eight grammars is the second-largest payload any island
 * pulls, so declaring this edge is what lets a grid with no `code` column skip
 * it entirely (ecoconception R2). The crud-form's `code` field and the JSON and
 * YAML config editors resolve the same underlying module, so a page carrying a
 * grid and a form downloads it once.
 */
export const loadCodeCellEditor = () =>
  import('./data-table/editors/code-editor').then((m) => m.default)

// SSR's "which component types need a hydration script" set lives in
// `src/presentation/utils/island-component-types.ts` (a smaller subset
// of ISLANDS — not every registry entry triggers bundle building, only
// the ones that gate `<script src="islands.js">` emission). Don't add
// a parallel set here; the consolidated source of truth is upstream.
