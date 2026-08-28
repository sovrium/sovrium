/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { serializeJsonForScript } from '@/domain/utils/json-script-serialization'
import { COMMAND_PALETTE_RUNTIME } from './command-palette-runtime'
import type { ComponentDispatchConfig, ComponentRenderer } from '../component-dispatch-config'
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

/**
 * Admin-shell variant of the config-native `command-palette` component
 * (Consoles-as-Config, batch C3). The Native Admin Dashboard expresses its ⌘K
 * palette through this component instead of a bespoke shell island: it emits the
 * canonical `data-command-palette-config` marker (so the page advertises a
 * config-native palette) and hosts the `admin-search-palette` island, which
 * provides the admin cross-entity search affordance (`/api/admin/search`,
 * grouped results, French operator microcopy) the dashboard needs.
 *
 * It deliberately omits the generic `command-palette-runtime` `<script>`: the
 * admin search is served by the island, and shipping the generic runtime too
 * would open a SECOND palette on the same ⌘K. The admin config payload carries
 * `{ adminSearch: true }` so the marker is a genuine config block, not an inert
 * placeholder.
 */
function renderAdminCommandPalette(): ReactElement {
  const adminConfigJson = JSON.stringify({ adminSearch: true })
  return (
    <>
      <script
        type="application/json"
        data-command-palette-config="true"
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- one-time SSR config emission
        dangerouslySetInnerHTML={{ __html: adminConfigJson }}
      />
      <div
        data-island="admin-search-palette"
        data-island-props="{}"
        className="hidden"
      >
        <span className="sr-only" />
      </div>
    </>
  )
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
  // Admin-shell variant (Consoles-as-Config C3): the dashboard mounts
  // `{ type: 'command-palette', props: { adminSearch: true } }` to express its
  // ⌘K palette as config. It hosts the admin-search island and emits the config
  // marker without the generic runtime — see `renderAdminCommandPalette`.
  const adminSearch = (config.component?.props as { readonly adminSearch?: boolean } | undefined)
    ?.adminSearch
  if (adminSearch === true) {
    return renderAdminCommandPalette()
  }

  const tables = ((config.tables ?? []) as ReadonlyArray<PaletteTable>).map((table) => ({
    name: table.name,
    fields: (table.fields ?? [])
      .filter((field) => TEXT_FIELD_TYPES.has(field.type))
      .map((field) => ({ name: field.name })),
  }))
  const componentProps = (config.component?.props ?? {}) as { readonly pages?: PalettePage[] }
  const pages = Array.isArray(componentProps.pages) ? componentProps.pages : []
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
