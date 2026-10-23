/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The hand tables of the CSS attribution walk (`./css-attribution.ts`): the
 * facts about the tree that no reader can derive from it — where every walk
 * stops, which `ISLANDS` keys each component type mounts, which islands every
 * page or only the console mounts, which resolvers gate one type's subtree,
 * and which paths belong to the operator console.
 */

// =============================================================================
// Hand tables — the three facts the tree does not state
// =============================================================================

/**
 * The files every walk stops at: each one reaches (nearly) everything, so
 * traversing it would attribute the whole tree to whichever type got there
 * first. Their own literals are CORE.
 */
export const STOP_SET: readonly string[] = [
  'src/presentation/render/registry/component-registry.ts',
  'src/presentation/render/registry/component-type-dispatcher.tsx',
  'src/presentation/islands/island-registry.ts',
  'src/presentation/islands/island-client.tsx',
  'src/presentation/islands/view-type-islands.ts',
]

/**
 * Component type → the `ISLANDS` keys its renderer mounts. A type is not an
 * island key: `form` mounts `crud-form` or `auth-form`, `sheet` a
 * `record-drawer`, `sidebar` six keys. Read off the `data-island="…"` markers
 * each renderer emits; a key may be mounted by several types (`collapsible`
 * by `collapsible` and `sidebar`, `record-drawer` by `sheet` and `table`).
 */
export const ISLANDS_BY_TYPE: Readonly<Record<string, readonly string[]>> = {
  table: ['table', 'record-drawer'],
  resizable: ['resizable'],
  stepper: ['stepper'],
  'signature-pad': ['signature-pad'],
  tree: ['tree'],
  map: ['map'],
  kanban: ['kanban'],
  'event-calendar': ['event-calendar'],
  gallery: ['gallery'],
  carousel: ['carousel'],
  chart: ['chart'],
  graph: ['graph'],
  kpi: ['kpi'],
  timeline: ['timeline'],
  list: ['list', 'search-list'],
  sidebar: [
    'sidebar-groups',
    'sidebar-badge',
    'sidebar-disclosure',
    'sidebar-current',
    'sidebar-drawer',
    'collapsible',
  ],
  'record-field': ['record-field-system', 'record-field-button'],
  'rich-text-editor': ['rich-text-editor'],
  'code-editor': ['code-editor'],
  'date-range-picker': ['date-range-picker'],
  'filter-bar': ['filter-bar'],
  form: ['crud-form', 'auth-form', 'form-field'],
  tabs: ['tabs', 'crud-form'],
  'ai-chat': ['ai-chat'],
  dialog: ['dialog'],
  'alert-dialog': ['alert-dialog'],
  select: ['select'],
  combobox: ['combobox'],
  accordion: ['accordion'],
  collapsible: ['collapsible'],
  'message-scroller': ['message-scroller', 'reply-thread'],
  questionnaire: ['questionnaire'],
  calendar: ['calendar'],
  checkbox: ['checkbox'],
  'radio-group': ['radio-group'],
  switch: ['switch'],
  tooltip: ['tooltip'],
  popover: ['popover'],
  'hover-card': ['hover-card'],
  sheet: ['sheet', 'record-drawer'],
  drawer: ['drawer'],
  'dropdown-menu': ['dropdown-menu'],
  breadcrumb: ['dropdown-menu'],
  'context-menu': ['context-menu'],
  'record-picker': ['record-picker'],
  slider: ['slider'],
  toggle: ['toggle'],
  'toggle-group': ['toggle-group'],
  menubar: ['menubar'],
  'navigation-menu': ['navigation-menu'],
  'notification-bell': ['notification-bell'],
  'scroll-area': ['scroll-area'],
  input: ['date-picker', 'file-upload', 'number-input'],
  'file-upload': ['file-upload'],
  'number-input': ['number-input'],
  'input-otp': ['input-otp'],
  'date-picker': ['date-picker'],
  'search-input': ['search-input'],
  comments: ['comments', 'comment-count'],
  button: ['open-import'],
}

/**
 * Islands every page may mount regardless of its components → CORE.
 * `form-field` is not one: it is mounted only by a server-rendered form — a
 * hosted form's own page, or a form a page or a dialog embeds — so it rides the
 * `form` type, which the compiler counts as declared whenever the app declares
 * `forms` (`resolveNativeFreeCandidates`).
 */
export const PAGE_LEVEL_ISLANDS: readonly string[] = [
  'command',
  'presence-indicator',
  'page-record-system',
  'spa-nav',
]

/** Islands only the operator console mounts → the console set. */
export const CONSOLE_ISLANDS: readonly string[] = [
  'admin-spa-nav',
  'admin-agent-conversations',
  'admin-report-link',
  'api-key-manager',
  'design-system-rail',
]

/**
 * Registry keys never schema-authored: synthesized at render time and injected
 * into every page (or every record-bound container), so their classes are CORE.
 * Mirrors `SYNTHESIZED_COMPONENT_TYPES` in the registry — read from the source
 * so the two cannot drift silently.
 */
export const SYNTHESIZED_TYPES_FILE =
  'src/presentation/render/registry/synthesized-component-types.ts'

/**
 * The pages the engine draws itself — the default home page, the not-found
 * page and the error page — placed through the same component dispatcher as an
 * app's pages, with types the app's config never names. The component types
 * those pages place are CORE, or an app declaring none of them would render
 * its own 404 page half-styled. Read from the source (every `type: '…'`
 * literal in the file) so the two cannot drift.
 */
export const ENGINE_PAGES_FILE = 'src/presentation/render/page/default-page-configs.ts'

/**
 * Resolvers the CORE walk does not enter. Each runs on every page (so the page
 * shell imports it) but acts only when ONE component type is present, and its
 * imports are that type's subtree: entering it from the shell would attribute
 * the whole subtree to CORE. Each entry must be reached by a type walk — a
 * stale entry (the resolver moved, or no type reaches it any more) throws.
 */
export const CORE_WALK_BOUNDARY: readonly string[] = [
  // `field-specimen` only: renders every field control through
  // `elements/field-specimen-renderer.ts` → `islands/parts/crud-form/fields`.
  'src/presentation/render/resolve/field-specimen-resolver.ts',
  // An open specimen of `date-picker`, `date-range-picker` or `dropdown-menu`
  // only: draws the open popup through `elements/open-specimen-renderer.ts`.
  'src/presentation/render/resolve/open-specimen-markup.ts',
]

/** Files whose classes belong to the console alone, by path prefix. */
export const CONSOLE_PATH_PREFIXES: readonly string[] = [
  'src/admin/',
  'src/presentation/islands/admin/',
  'src/infrastructure/assets/embedded-admin-preset.generated.ts',
]
