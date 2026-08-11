/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lazy } from 'react'
import AdminAgentConversationsIsland from './admin/agents/admin-agent-conversations-island'
import SharedFilterSelectIsland from './admin/automations/shared-filter-select-island'
import AdminCommandPaletteIsland from './admin/command-palette/admin-command-palette-island'
import AdminSpaNavIsland from './admin/spa-nav/admin-spa-nav-island'
import AiChatIsland from './ai-chat-island'
import AuthFormIsland from './auth-form/auth-form-island'
import CrudFormIsland from './crud-form-island'
import DatePickerIsland from './date-picker/date-picker-island'
import TabsIsland from './disclosure/tabs-island'
import FileUploadIsland from './file-upload/file-upload-island'
import NumberInputIsland from './form-controls/number-input-island'
import SplitPaneIsland from './layout/split-pane-island'
import RecordDrawerIsland from './overlays/record-drawer-island'
import PageRecordSystemIsland from './pages/page-record-system-island'
import { CalendarIslandLazy, GalleryIslandLazy, KanbanIslandLazy } from './view-type-islands'

/**
 * Island component registry — maps island type names to React components.
 *
 * Auth and CRUD form islands are eagerly imported to mount synchronously,
 * preventing native form submission from the SSR skeleton before React
 * takes over event handling. Data table and search list use React.lazy()
 * for code splitting since they don't have the same timing constraints.
 *
 * To add a new island type:
 * 1. Create the component in src/presentation/islands/
 * 2. Add an import entry here (lazy or eager)
 * 3. Add the SSR placeholder in island-components.tsx
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Island props vary by type
export const ISLANDS: Record<string, React.ComponentType<any>> = {
  'data-table': lazy(() => import('./data-table/island')),
  // `split-pane` — resizable two-pane layout enhancement island. Renders
  // nothing; wires pointer-drag onto the SSR-rendered static structure so the
  // nested islands inside each pane survive hydration
  //. EAGER-imported (same timing
  // constraint as file-upload / number-input): the drag must be wired before
  // the user (or the spec) drags the divider, so it cannot wait for a lazy
  // chunk to resolve. The component itself is tiny (renders null), so the
  // eager import is eco-negligible.
  'split-pane': SplitPaneIsland,
  // The three view-type islands are bound ONCE in `view-type-islands.ts`,
  // because the data-table's view switcher renders the SAME lazy components
  // when it swaps the grid out. One binding keeps both consumers on one chunk
  // per view type (and keeps all three off the universal island payload).
  kanban: KanbanIslandLazy,
  calendar: CalendarIslandLazy,
  gallery: GalleryIslandLazy,
  chart: lazy(() => import('./chart/chart-island')),
  kpi: lazy(() => import('./kpi/kpi-island')),
  'data-timeline': lazy(() => import('./timeline/timeline-island')),
  // `list` (CAP-1) — a list with `listDisplay.itemTemplate` + a `dataSource`
  // (DB table OR system read endpoint) renders its items CLIENT-side via this
  // island. The search-mode list keeps the separate `search-list` island below.
  list: lazy(() => import('./list/list-island')),
  // `record-field-system` (CAP-2) — a `record-field` with its OWN
  // `dataSource.system` SELF-binds to a system DETAIL endpoint: it fetches ONE
  // record (the route id injected into the `:param` slot) and renders `props.field`
  // CLIENT-side. A record-field WITHOUT a dataSource keeps inheriting from its
  // container server-side (the SSR path), so this island only mounts for the
  // self-binding system variant. Lazy-loaded (eco R2) — tiny fetch-and-render.
  'record-field-system': lazy(() => import('./record-field/record-field-system-island')),
  // `page-record-system` (CAP-2) — a PAGE whose page-level `dataSource.system`
  // binds it to ONE record from a system DETAIL endpoint. A pure side-effect
  // enhancer: it fetches the detail record and distributes `$record.*` into the
  // SSR page text nodes in place (renders nothing). EAGER-imported so the fetch
  // fires promptly on mount rather than waiting for a lazy chunk (the enhancer is
  // tiny — eco-negligible).
  'page-record-system': PageRecordSystemIsland,
  'search-list': lazy(() => import('./search/search-list-island')),
  'auth-form': AuthFormIsland,
  'crud-form': CrudFormIsland,
  // Eagerly imported so the island mounts synchronously, taking over the
  // input row before the user can type into the SSR skeleton (same timing
  // constraint as the auth/crud form islands above).
  'ai-chat': AiChatIsland,

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
  // `tabs` — EAGER-imported (not lazy). The per-domain admin dashboards (tables /
  // pages / automations) make the 4-tab frame their PRIMARY content and the specs
  // interact with the tablist immediately after `page.goto` (assert the active
  // tab, click a tab). A lazy chunk leaves the SSR tab skeleton (no `tablist`
  // role) up past the first assertion under worker contention, so the tabs island
  // must mount synchronously — same "wire before first interaction" rationale as
  // record-grid / record-drawer / crud-form / split-pane. The island is a thin
  // Base UI Tabs wrapper, so the eager import is eco-negligible.
  tabs: TabsIsland,
  checkbox: lazy(() => import('./form-controls/checkbox-island')),
  'radio-group': lazy(() => import('./form-controls/radio-island')),
  switch: lazy(() => import('./form-controls/switch-island')),
  // Phase 2 — Overlays & Feedback
  tooltip: lazy(() => import('./overlays/tooltip-island')),
  popover: lazy(() => import('./overlays/popover-island')),
  'hover-card': lazy(() => import('./overlays/hover-card-island')),
  drawer: lazy(() => import('./overlays/drawer-island')),
  // `record-drawer` — record-detail/edit drawer specialization
  //. EAGER-imported so its
  // `sovrium:open-drawer` listener is wired before a data-table row click can
  // fire (the dispatch arrives synchronously on click); a lazy chunk would
  // miss the first event.
  'record-drawer': RecordDrawerIsland,
  'dropdown-menu': lazy(() => import('./overlays/menu-island')),
  'context-menu': lazy(() => import('./overlays/menu-island')), // Shares menu island
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
  // `admin-sidebar` — Native Admin Dashboard three-zone sidebar
  // ([internal ref] count badges + [internal ref] list/add/
  // remove). Sources its element lists/counts from the draft and mutates the
  // draft via the existing per-family routes. Lazy-loaded (eco) — the spec
  // waits on `data-island-ready` before interacting.
  'admin-sidebar': lazy(() => import('./admin/sidebar/admin-sidebar-island')),
  // NOTE: the `admin-record-grid` bespoke island was retired ([internal ref] dogfood) —
  // the Données surface now renders the record
  // grid via the GENERIC `data-table` component bound to the operator table by
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
  // `dataSource.system` from its action column — see `automation-runs-surface.ts`.
  // The `admin-automation-runs-detail` + `-retry` islands were dropped.)
  // `shared-filter-select` — the automation + status shared-filter PUBLISHER for
  // the CONVERTED runs directory ([internal ref],
  // the config expression of -DATATABLE-004). Renders the "Filtrer par
  // automatisation" / "Filtrer par état" comboboxes outside the data-table toolbar
  // and publishes its selection on the shared `island:system-query` bus tagged with
  // its OWN publisher id; the grid declares `dataSource.system.bindTo` +
  // `sharedFilter` so the runtime subscribes it (merging `?automationName=` /
  // `?status=`). EAGER so the filters drive the grid immediately on first paint.
  'shared-filter-select': SharedFilterSelectIsland,
  // NOTE: the FORMS Données surface (`admin-form-submissions` + `admin-form-metrics`)
  // was DROPPED in the [internal ref] dogfood pass — the Soumissions page now renders via
  // GENERIC components (a `data-table` system source for the list, a `kpi` system
  // source for the metric, a `fetch`/`download` action for the CSV export, and a
  // system-detail `record-drawer` for the per-submission drill-down). See
  // `application/use-cases/admin/dashboard-surfaces/data-forms-surface.ts`.
  // NOTE: the RGPD Données & RGPD surface (`admin-gdpr`) was DROPPED in the [internal ref]
  // dogfood pass — the Mon compte page now renders via GENERIC config (a
  // session-bound `text` identity, `mode: download` / confirm-gated `fetch` action
  // buttons with a persistent `onSuccess.status`, and a system-source `data-table`
  // for the pending erasure). See
  // `application/use-cases/admin/dashboard-surfaces/gdpr-surface.ts`.
  // `admin-mcp-connect` — the MCP "Connecter votre IA" island was RETIRED in the
  // [internal ref] dogfood pass. The `/_admin/mcp` MCP page now renders via GENERIC config:
  // a static `content/code` endpoint reference + an "Émettre un identifiant"
  // RFC-7591 register curl (`POST /api/auth/oauth2/register`, fully curl-usable) +
  // the static "Configuration de référence" Claude-wiring card. Accepted loss: the
  // live-origin fill-in, one-click credential copy, and live status pill. See
  // `application/use-cases/admin/dashboard-surfaces/mcp-docs-surface.ts`.
  // (The Data-tab Utilisateurs page — [internal ref] — is now
  // composed from GENERIC Sovrium config: a `kpi` strip + a system-bound
  // `data-table` over `GET /api/admin/users`, with the row gestures rewired onto
  // config `fetch` actions. The bespoke `admin-users-directory` island + its
  // `EndUserRow` / `MetricCard` / `AddUserForm` helpers were retired in the
  // Consoles-as-Config conversion — see `data-users-surface.ts`.)
  // (The Data-tab Statistiques page — [internal ref] — is now
  // composed from GENERIC Sovrium config: a `kpi` strip + a system-bound `chart`
  // + a system-bound `data-table` over the page-view analytics backend. The
  // former bespoke per-analytics island was retired in the dogfooding conversion,
  // so it no longer needs a registry entry.)
  // `admin-spa-nav` — Native Admin Dashboard content-only (SPA) navigation
  //. Renders nothing; intercepts left-clicks on
  // `/_admin/*` links and swaps ONLY the `#admin-surface-content` region via a
  // content-only partial fetch (keeping the persistent sidebar + ⌘K palette
  // mounted), routes ⌘K palette selections through the same swap path, handles
  // back/forward via popstate, and falls back to a full nav on a non-OK partial.
  // EAGER-imported so the global click interceptor is live before the first nav
  // click. Mounted via a `data-island` marker in the shell chrome (outside the
  // swap region so its listeners survive content swaps).
  'admin-spa-nav': AdminSpaNavIsland,
  // `admin-search-palette` — Native Admin Dashboard ⌘K command palette
  //. Consoles-as-
  // Config (batch C3): the shell now expresses its ⌘K palette through the config-
  // native `command-palette` component (admin mode), which hosts THIS island as
  // the admin cross-entity search provider (`/api/admin/search`, grouped results,
  // French operator microcopy). `⌘K` / `Ctrl+K` (and the shell's "Rechercher"
  // affordance) open the dialog; selecting a result deep-links to the matching
  // surface. EAGER-imported so the open-intent listener is wired before the first
  // keypress; it renders null until opened, so the eager import is eco-negligible.
  // Mounted via the `data-island="admin-search-palette"` host the config
  // `command-palette` component emits.
  'admin-search-palette': AdminCommandPaletteIsland,
  // (The `admin-bucket-metrics` + `admin-bucket-files` bespoke islands were retired:
  // the `/_admin/buckets/:name` file browser is now a generic config surface —
  // a quota `kpi`, an upload `file-upload`, and a file `data-table` bound via
  // `dataSource.system` to `GET /api/admin/buckets/:name/files` with a CAP-3
  // `mode: download` per-row action. See `data-buckets-surface.ts`.)
  // `admin-agent-conversations` — Native Admin Dashboard agents Données surface
  //. The ChatGPT-style read-only conversation
  // viewer: a conversation list (`GET /api/admin/agents/:name/conversations`) +
  // the selected conversation's message thread (`.../conversations/:id`). EAGER-
  // imported (same rationale as record-grid / bucket-files): the viewer is the
  // surface's primary content. Mounted via a `data-island` marker on a generic
  // container.
  'admin-agent-conversations': AdminAgentConversationsIsland,
  // (The `admin-connections-directory` bespoke island was retired: the
  // `/_admin/connections` directory is now a generic config `data-table` bound via
  // `dataSource.system` to `GET /api/admin/connections` — see
  // `data-connections-surface.ts`, the flagship Consoles-as-Config conversion.)
  // File-upload (dropzone variant) — wires client-side size/count validation
  // on top of the SSR placeholder rendered by `renderFileUpload`. Eagerly
  // imported so the React handler takes over BEFORE the test (or user) calls
  // `setInputFiles` on the SSR placeholder's <input>; with lazy loading the
  // SSR input handles the change event and the validation island never sees
  // the file. Only mounted when the schema sets `dropZone: true` (see
  // interactive-components.ts).
  'file-upload': FileUploadIsland,
  // Number-input — adds explicit `+` / `-` stepper buttons and on-blur
  // min/max value clamping on top of the native `<input type="number">`
  // (which gives us `role="spinbutton"` + ArrowUp/ArrowDown for free).
  // Eager-imported for the same reason as file-upload: the test (or user)
  // typically interacts immediately after `page.goto(...)`.
  'number-input': NumberInputIsland,
  // Date-picker — composes a popover trigger with a react-day-picker
  // calendar grid. Supports `single` / `range` selection modes and
  // `minDate` / `maxDate` constraints. Eager-imported so the trigger
  // button takes over before the test interacts.
  'date-picker': DatePickerIsland,
  // Page-search — wires the build-time TF-IDF index (under
  // `/sovrium-search/index.json`) to a live results panel. Lazy-loaded so
  // the chunk is only fetched on pages that actually carry a `pageSearch`
  // component.
  'page-search': lazy(() => import('./search/page-search-island')),
  // Comment thread + count (PG-01 / PG-02). The comment-count island
  // fetches the total from the existing comments-API pagination metadata;
  // the comment-thread island hydrates the section with the paged list,
  // authenticated form, edit/delete affordances, sort dropdown, and
  // load-more / numbered pagination. Both lazy-imported — no eager-timing
  // constraint (the SSR skeleton's `<p data-comments-empty-state>` /
  // SSR-rendered count label is the user-visible fallback until hydration).
  comments: lazy(() => import('./comments/comment-thread-island')),
  'comment-count': lazy(() => import('./comments/comment-count-island')),
  // Schema/config editor islands (platform B10). The CodeMirror JSON/YAML
  // editors ship; they mount the shared `schema-config-editor` core and on
  // Submit POST the edited text to the records API for `submitToTable`,
  // tagging the row with `format: 'json' | 'yaml'`. Lazy-loaded — the SSR
  // placeholder (emitted by `island-editor-components.tsx`) is the visible
  // fallback until the chunk resolves.
  //
  // `schema-form-editor` mounts a structured, no-code config builder (labeled
  // section inputs → serialized config tagged `format: 'form'`); `schema-ai-agent`
  // mounts a natural-language chat surface (prompt → config submission tagged
  // `format: 'ai'`). Both POST to the records API via the shared submit helper.
  'schema-json-editor': lazy(() => import('./schema-editor/schema-json-editor-island')),
  'schema-yaml-editor': lazy(() => import('./schema-editor/schema-yaml-editor-island')),
  'schema-form-editor': lazy(() => import('./schema-editor/schema-form-editor-island')),
  'schema-ai-agent': lazy(() => import('./schema-editor/schema-ai-agent-island')),
}

/**
 * The `rich-text` inline cell editor for the data-table grid.
 *
 * This module owns most of the island tree's dynamic imports, but not all of
 * them: the crud-form's own deferred `code` and `rich-text` fields declare
 * theirs next to their consumers, because a loader here would have to be
 * imported BACK by a module this file already imports eagerly
 * (`CrudFormIsland`), closing a static cycle. Every dynamic edge that is not
 * reached through an eager import belongs here; the crud-form's two cannot.
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

// SSR's "which component types need a hydration script" set lives in
// `src/presentation/utils/island-component-types.ts` (a smaller subset
// of ISLANDS — not every registry entry triggers bundle building, only
// the ones that gate `<script src="islands.js">` emission). Don't add
// a parallel set here; the consolidated source of truth is upstream.
