/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { serializeJsonForScript } from '@/domain/kernel/sanitize/json-script-serialization'
import { COMMAND_PALETTE_RUNTIME } from './command-palette-runtime'
import type { ComponentDispatchConfig, ComponentRenderer } from './component-dispatch-config'
import type { ReactElement } from 'react'

/** Field types whose physical columns surface as text inputs in the form. */
const TEXT_FIELD_TYPES = new Set([
  'single-line-text',
  'long-text',
  'rich-text',
  'email',
  'url',
  'number',
  'phone-number',
])

/** Minimal table shape consumed by the quick-action creation dialogs. */
interface PaletteTable {
  readonly name: string
  readonly fields?: ReadonlyArray<{ readonly name: string; readonly type: string }>
}

/** Minimal navigable-page shape carried in the synthesized component props. */
interface PalettePage {
  readonly name: string
  readonly path: string
  readonly title: string
}

/** The palette's declared search mode, as it reaches the renderer. */
interface PaletteSearch {
  readonly endpoint: string
  readonly placeholder?: string
  readonly kindLabels?: Readonly<Record<string, string>>
}

/**
 * The admin console's own search binding.
 *
 * The console still reaches this renderer through a builder-set
 * `props.adminSearch` flag rather than through an authored `search` block.
 * Mapping the flag onto the SAME shape an authored palette uses is what keeps
 * one code path: when the console becomes config, the flag disappears and the
 * block is authored instead, with no renderer change at all. The group headings
 * are deliberately absent — the island falls back to its own kind labels, which
 * is the behaviour the console already shipped.
 */
const ADMIN_SEARCH: PaletteSearch = { endpoint: '/api/admin/search' }

/**
 * SEARCH mode: point ⌘K at a read endpoint instead of at the built-in quick
 * actions.
 *
 * Two things travel to the client and nothing else: the canonical
 * `data-command-palette-config` marker (so the page advertises exactly one
 * palette) carrying the declared binding, and the `command-palette` island that
 * hosts the overlay.
 *
 * The generic `command-palette-runtime` `<script>` is deliberately omitted. Both
 * runtimes bind the same ⌘K, so shipping them together would open two overlays
 * on one keystroke — which is why `search` is a MODE rather than an addition.
 */
function renderSearchPalette(search: PaletteSearch): ReactElement {
  const configJson = serializeJsonForScript({ search })
  const islandProps = serializeJsonForScript({
    endpoint: search.endpoint,
    ...(search.placeholder !== undefined ? { placeholder: search.placeholder } : {}),
    ...(search.kindLabels !== undefined ? { kindLabels: search.kindLabels } : {}),
  })
  return (
    <>
      <script
        type="application/json"
        data-command-palette-config="true"
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- one-time SSR config emission
        dangerouslySetInnerHTML={{ __html: configJson }}
      />
      <div
        data-island="command-palette"
        data-island-props={islandProps}
        className="hidden"
      >
        <span className="sr-only" />
      </div>
    </>
  )
}

/**
 * One quick action, as `quickActions()` in `command-palette-runtime-actions.ts`
 * builds it. Mirrored here so a SPECIMEN can be drawn server-side; see
 * {@link renderSpecimenOverlay} for why the mirror is the only option.
 */
interface QuickAction {
  readonly label: string
  readonly action: string
}

/**
 * The quick-action catalogue, derived from the SAME config the live runtime
 * reads: one "create" per table, one "go to" per navigable page, and the
 * unconditional dark-mode toggle.
 *
 * A transcription of `quickActions()`, which lives in the runtime as a
 * JavaScript SOURCE STRING and therefore cannot be imported. The duplication is
 * real and is the cheaper of two bad options: the alternative is a specimen
 * whose result rows are invented here, which would document this file instead
 * of the palette.
 */
const specimenQuickActions = (
  tables: ReadonlyArray<{ readonly name: string }>,
  pages: ReadonlyArray<PalettePage>
): readonly QuickAction[] => [
  ...tables.map((table) => ({
    label: `Create new record in ${table.name}`,
    action: `create-record:${table.name}`,
  })),
  ...pages.map((page) => ({
    label: `Go to ${page.title.length > 0 ? page.title : page.name}`,
    action: 'navigate',
  })),
  { label: 'Toggle dark mode', action: 'toggle-dark-mode' },
]

/**
 * A quick action matches a query when every whitespace-separated token appears
 * in its label — `actionMatchesQuery` in the runtime, transcribed for the same
 * reason as above.
 */
const specimenActionMatches = (label: string, query: string): boolean => {
  const haystack = label.toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((token) => token.length === 0 || haystack.includes(token))
}

/**
 * SPECIMEN mode: the overlay as a still picture, in place, wired to nothing.
 *
 * ─── WHY A MODE, WHEN THE WHOLE FILE EXISTS TO RENDER NOTHING ──────────────
 *
 * The live palette deliberately emits no overlay DOM: two `role="dialog"` and
 * two `role="searchbox"` in one document resolve every unrelated query twice.
 * That is a fact about a page that HOSTS a palette, and the design-system
 * console's own state strip is not that page — it needs the overlay's
 * appearance and must not acquire a second live palette to get it.
 *
 * So this draws the overlay's own markup and withholds everything that makes it
 * a palette: no `[data-command-palette-config]` block (the page still advertises
 * exactly one palette — its own), no runtime `<script>`, no `data-island`, and
 * no `role="dialog"` / `aria-modal` (one keystroke still opens exactly one
 * dialog, and this is not it). The shell keeps `data-command-palette` because
 * that is the selector `theme/command-palette-styles.ts` paints the panel, the
 * search row and the result rows through — a specimen wearing different classes
 * would document a palette nobody ships.
 *
 * `query` is what the overlay is drawn WITH, and it is what makes the `empty`
 * cell a real state rather than a second copy of `default`: the runtime's own
 * filter drops every action that does not match, and a query matching none
 * leaves the list the palette actually shows when it has nothing to offer.
 */
function renderSpecimenOverlay(
  tables: ReadonlyArray<{ readonly name: string }>,
  pages: ReadonlyArray<PalettePage>,
  query: string
): ReactElement {
  const matched = specimenQuickActions(tables, pages).filter(
    (action) => query.trim().length === 0 || specimenActionMatches(action.label, query)
  )
  return (
    <div
      data-command-palette="true"
      data-command-palette-specimen="true"
      data-component="command-palette"
      className="flex justify-center p-4"
    >
      <div className="w-full max-w-lg overflow-hidden">
        <input
          data-command-palette-input="true"
          type="search"
          role="searchbox"
          aria-label="Search"
          placeholder="Search…"
          defaultValue={query}
          readOnly
          className="w-full border-none outline-none"
        />
        <div
          data-command-palette-results="true"
          className="max-h-64 overflow-y-auto"
        >
          {matched.length > 0 && (
            <section data-command-palette-section="actions">
              <h3 data-command-palette-heading="quick actions">Quick actions</h3>
              {matched.map((action) => (
                <div
                  key={action.label}
                  role="option"
                  aria-selected="false"
                  aria-label={action.label}
                  data-command-action={action.action}
                >
                  <span>{action.label}</span>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Is this drawing a SPECIMEN, and with what search text?
 *
 * Reached through `props` for the same reason `props.adminSearch` is: it is set
 * by the surface DRAWING the palette, never by an app author describing one
 * they want to work.
 */
const specimenQueryOf = (component: ComponentDispatchConfig['component']): string | undefined => {
  const props = (component as { readonly props?: Record<string, unknown> } | undefined)?.props
  if (props?.['specimen'] !== true) return undefined
  const query = props['specimenQuery']
  return typeof query === 'string' ? query : ''
}

/**
 * The palette's search binding, reached two ways that produce the same output:
 * an authored `search` block, and the console's builder-set `props.adminSearch`
 * flag — the same binding written in TypeScript rather than in config.
 */
function resolveSearchMode(
  component: ComponentDispatchConfig['component']
): PaletteSearch | undefined {
  const node = component as
    | { readonly search?: PaletteSearch; readonly props?: { readonly adminSearch?: boolean } }
    | undefined
  if (node?.search !== undefined) return node.search
  return node?.props?.adminSearch === true ? ADMIN_SEARCH : undefined
}

/**
 * Renderer for the render-time-synthesized `command-palette` component.
 *
 * This component type is never schema-authored — it is injected into every
 * page by `render-page` so the global `Cmd+K` palette is available app-wide.
 *
 * The renderer emits ONLY two `<script>` tags: a JSON config block (tables +
 * their text fields + navigable pages) and the inline runtime. It deliberately
 * renders **no overlay / dialog / input DOM at all** server-side.
 *
 * Rationale — the command palette is a global, always-present feature. If its
 * `<input role="searchbox">` and `<div role="dialog">` were pre-rendered into
 * every page's SSR output, they would pollute generic page selectors used by
 * unrelated specs (`page.locator('input')`, `page.locator('[role="dialog"]')`
 * would resolve two elements and fail Playwright strict mode). Instead, the
 * runtime (`command-palette-runtime.ts`) builds the entire overlay DOM lazily
 * on the first `Cmd+K` and keeps it cached thereafter — so a page that never
 * opens the palette stays free of command-palette DOM.
 *
 * Quick actions — "Create new
 * record in <table>", "Go to <page>", "Toggle dark mode" — and the per-table
 * record-creation dialog are likewise assembled entirely client-side by the
 * runtime from the JSON config.
 */
export const commandPaletteComponent: ComponentRenderer = (
  config: ComponentDispatchConfig
): ReactElement => {
  const search = resolveSearchMode(config.component)
  const specimenQuery = specimenQueryOf(config.component)
  if (search !== undefined && specimenQuery === undefined) {
    return renderSearchPalette(search)
  }

  const tables = ((config.tables ?? []) as ReadonlyArray<PaletteTable>).map((table) => ({
    name: table.name,
    fields: (table.fields ?? [])
      .filter((field) => TEXT_FIELD_TYPES.has(field.type))
      .map((field) => ({ name: field.name })),
  }))
  const componentProps = (config.component?.props ?? {}) as { readonly pages?: PalettePage[] }
  const pages = Array.isArray(componentProps.pages) ? componentProps.pages : []
  if (specimenQuery !== undefined) return renderSpecimenOverlay(tables, pages, specimenQuery)
  const paletteConfig = {
    tables: tables.map((table) => ({ name: table.name, fields: table.fields })),
    pages: pages.map((page) => ({ name: page.name, path: page.path, title: page.title })),
  }
  // `serializeJsonForScript` escapes `<` so a value containing `</script>`
  // cannot break out of the JSON config `<script>` block. This escape used to
  // live here as a local one-off; it is now the shared serializer every
  // script-body emission in src/ uses.
  const paletteConfigJson = serializeJsonForScript(paletteConfig)
  return (
    <>
      <script
        type="application/json"
        data-command-palette-config="true"
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- one-time SSR config emission
        dangerouslySetInnerHTML={{ __html: paletteConfigJson }}
      />
      <script
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- one-time SSR runtime emission
        dangerouslySetInnerHTML={{ __html: COMMAND_PALETTE_RUNTIME }}
      />
    </>
  )
}
