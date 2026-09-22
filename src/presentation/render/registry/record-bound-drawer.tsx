/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { resolveRecordDrawerFieldProp } from '@/presentation/render/props/resolve-record-drawer-fields'
import type { ComponentRenderer } from './component-dispatch-config'
import type { ReactElement } from 'react'

/**
 * Hidden until the island opens it.
 *
 * Declared here rather than imported: the sibling that also needs it
 * (`row-expand-drawer-host.tsx`) keeps its own copy for the same reason, and a
 * two-property literal shared across three modules buys an import edge and no
 * safety — a divergence would be visible in the rendered markup.
 */
const HIDDEN_STYLE = { display: 'none' } as const

/**
 * The authored slot, as markup the island can inject (CAP-5).
 *
 * `undefined` when the author declared no children, and that matters: a key
 * whose value is `undefined` is DROPPED by `JSON.stringify`, so the serialised
 * props of a childless drawer are byte-for-byte what they were before this key
 * existed. The same crossing `buildDrawerProps` already makes for a plain
 * drawer, by the same route, so one slot does not learn a second grammar.
 */
function slotMarkup(renderedChildren: readonly ReactElement[]): string | undefined {
  if (renderedChildren.length === 0) return undefined
  return renderedChildren.map((child) => renderToStaticMarkup(child)).join('')
}

/**
 * A `drawer` carrying a `dataSource` — the record-detail/edit surface
 *.
 *
 * `id`, `dataSource`, `recordFields`, `actions`, `role` and `canEdit` are
 * SCHEMA top-level fields (siblings of `props`), read from `component`. The
 * drawer starts CLOSED (hidden) and is opened by the data-table's
 * `sovrium:open-drawer` dispatch; the island then fetches the record and
 * renders the schema-derived form.
 *
 * A standalone function rather than a registry entry: `record-drawer` stopped
 * being a component type, but it is still its own ISLAND, and the marker it
 * emits is what selects that island.
 */
export const renderRecordBoundDrawer: ComponentRenderer = ({
  rawProps,
  elementProps,
  component,
  renderedChildren,
  tables,
  languages,
  currentLang,
}) => {
  const comp = (component ?? {}) as Record<string, unknown>
  // CAP-2: `props.title` supplies the surface's accessible NAME; the default
  // is an INTERPRETER string resolved against the active language (English
  // default, French built-in, author override wins) rather than a French
  // literal served to apps of every language. `role` selects `dialog`
  // (default) | `region`.
  const title =
    (rawProps?.['title'] as string | undefined) ??
    resolveInterpreterString('recordDrawer.title', currentLang, languages)
  const role = comp['role'] === 'region' ? 'region' : 'dialog'
  // `dataSource` is discriminated: `{ table }` (DB-table fetch + PATCH) OR
  // `{ system }` (CAP-2 system DETAIL-endpoint binding — READ-ONLY). The island
  // branches on which key is present; a system source forces `canEdit` off.
  const dataSource = comp['dataSource'] as
    { readonly table?: string; readonly system?: unknown } | undefined
  const props = {
    id: comp['id'] as string | undefined,
    title,
    role,
    table: dataSource?.table,
    system: dataSource?.system,
    // `recordFields` is OPTIONAL: omitting it DERIVES one control per declared
    // field of the bound table (the "one component serves every table"
    // contract). Before this, the missing list defaulted to empty and the
    // drawer opened as a shell with nothing but a save button.
    recordFields: resolveRecordDrawerFieldProp(comp['recordFields'], component, tables),
    // CAP-1: footer actions fire against the loaded record at click time.
    actions: comp['actions'],
    // CAP-5: the composed-content slot. The island places it after the record
    // and before the footer, and resolves the `$record.*` tokens it carries once
    // the record lands — they cannot be resolved here, because at SSR the drawer
    // does not yet know which record it will be opened for.
    childrenHtml: slotMarkup(renderedChildren),
    canEdit: dataSource?.system === undefined && comp['canEdit'] !== false,
    // Interpreter-provided control labels, resolved server-side so author
    // `languages.translations` overrides apply (the island cannot see them).
    saveLabel: resolveInterpreterString('recordDrawer.save', currentLang, languages),
    closeLabel: resolveInterpreterString('recordDrawer.close', currentLang, languages),
  }
  return (
    <div
      data-island="record-drawer"
      data-island-props={JSON.stringify(props)}
      data-testid={elementProps['data-testid'] as string | undefined}
      style={HIDDEN_STYLE}
    >
      <div
        role={role}
        aria-label={title}
      >
        <p>Loading...</p>
      </div>
    </div>
  )
}
