/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ---------------------------------------------------------------------------
// View types offered by the data-table's view switcher
// ---------------------------------------------------------------------------

/**
 * A view type the data-table's `toolbar.viewSwitcher` can render.
 *
 * Each literal maps 1:1 onto an existing island (`kanban`, `calendar`,
 * `gallery`) plus the data-table's own grid. Switching is a PRESENTATION
 * change over the same bound dataset — the active filters, sorts, search and
 * grouping are unchanged by a switch, and no new query contract is introduced.
 */
export const DataTableViewTypeSchema = Schema.Literals([
  'grid',
  'kanban',
  'calendar',
  'gallery',
]).annotate({
  identifier: 'DataTableViewType',
  title: 'Data Table View Type',
  description:
    'A view type the data-table view switcher can render over the same dataset: grid | kanban | calendar | gallery',
})

/** @public */
export type DataTableViewType = Schema.Schema.Type<typeof DataTableViewTypeSchema>

/**
 * Ordered list of view types the switcher offers.
 *
 * The order is the tab order. `grid` is not implicit: a config that declares
 * `views` declares the complete set, so an author can offer a board-only or
 * calendar-only surface. When `views` is omitted the switcher offers `grid`
 * alone, which is the pre-existing behaviour of every config written before
 * this field existed.
 *
 * A view type listed here MUST be renderable from the config alone — `kanban`
 * requires `kanbanGroupBy`, `calendar` requires `dateField`. That requirement
 * is enforced by `validateDataTableViewTypes` at decode time rather than by a
 * `Schema.filter` on the array: cross-field rules belong with the other
 * cross-schema validators, and refinements on this chain inflate the type
 * depth of the whole `App` type.
 */
export const DataTableViewsSchema = Schema.Array(DataTableViewTypeSchema).pipe(
  Schema.check(Schema.isMinLength(1)),
  Schema.annotate({
    identifier: 'DataTableViews',
    title: 'Data Table Views',
    description:
      'Ordered list of view types offered by the toolbar view switcher (tab order). Omitted means grid only. Listing kanban requires kanbanGroupBy; listing calendar requires dateField.',
    examples: [
      ['grid', 'kanban'],
      ['grid', 'kanban', 'calendar', 'gallery'],
    ],
  })
)

// ---------------------------------------------------------------------------
// Switcher labels (accessibility contract)
// ---------------------------------------------------------------------------

/**
 * Labels for the view-switcher controls.
 *
 * These are not decoration: each becomes the `aria-label` of its switcher
 * button, so a Sovrium app shipped in French otherwise announces "Grid" and
 * "Kanban" to a screen reader in the middle of a French page. They are
 * authored in the app's own language, exactly like `emptyMessage` /
 * `noMatchMessage` / `emptyColumnMessage` — the established Sovrium pattern
 * for a localizable island string.
 *
 * Every key is optional and falls back to the English default, so existing
 * configs keep their current output byte-for-byte.
 */
export const DataTableViewLabelsSchema = Schema.Struct({
  /** Accessible name of the switcher group itself (default: "View") */
  group: Schema.optional(
    Schema.String.annotate({
      description:
        'Accessible name of the view-switcher button group (aria-label). Default: "View".',
      examples: ['View', 'Affichage'],
    })
  ),
  /** Label + aria-label of the grid button (default: "Grid") */
  grid: Schema.optional(
    Schema.String.annotate({
      description: 'Label and aria-label of the grid view button. Default: "Grid".',
      examples: ['Grid', 'Grille'],
    })
  ),
  /** Label + aria-label of the kanban button (default: "Kanban") */
  kanban: Schema.optional(
    Schema.String.annotate({
      description: 'Label and aria-label of the kanban view button. Default: "Kanban".',
      examples: ['Kanban', 'Tableau'],
    })
  ),
  /** Label + aria-label of the calendar button (default: "Calendar") */
  calendar: Schema.optional(
    Schema.String.annotate({
      description: 'Label and aria-label of the calendar view button. Default: "Calendar".',
      examples: ['Calendar', 'Agenda'],
    })
  ),
  /** Label + aria-label of the gallery button (default: "Gallery") */
  gallery: Schema.optional(
    Schema.String.annotate({
      description: 'Label and aria-label of the gallery view button. Default: "Gallery".',
      examples: ['Gallery', 'Galerie'],
    })
  ),
}).annotate({
  identifier: 'DataTableViewLabels',
  title: 'Data Table View Labels',
  description:
    'Localizable labels for the view-switcher controls. Each value becomes both the visible text and the aria-label of its button; omitted keys fall back to the English defaults.',
})

/** @public */
export type DataTableViewLabels = Schema.Schema.Type<typeof DataTableViewLabelsSchema>

// ---------------------------------------------------------------------------
// Per-view-type binding config
// ---------------------------------------------------------------------------

/**
 * Field whose distinct values become the kanban board's columns.
 *
 * Deliberately named `kanbanGroupBy`, not `groupBy` — the data-table already
 * owns a `groupBy` (its row-grouping config) and the two are independent: a
 * grid grouped by `owner` can switch to a board grouped by `status`. The
 * kanban component uses the same name for the same reason.
 */
export const DataTableKanbanGroupBySchema = Schema.Struct({
  /** Field name whose distinct values create the board's columns */
  field: Schema.String.annotate({
    description:
      'Field name whose distinct values create the kanban columns (a single-select / status field)',
    examples: ['status', 'stage'],
  }),
}).annotate({
  identifier: 'DataTableKanbanGroupBy',
  title: 'Data Table Kanban Group By',
  description:
    'Which field groups records into kanban columns when the view switcher renders the kanban view. Required whenever `views` includes `kanban`.',
})

/** @public */
export type DataTableKanbanGroupBy = Schema.Schema.Type<typeof DataTableKanbanGroupBySchema>

// ---------------------------------------------------------------------------
// Locating data-tables in a raw config
// ---------------------------------------------------------------------------

/**
 * The three keys the view-type PRESENCE rule reads.
 *
 * Deliberately structural rather than `DataTable`: the rule runs against the
 * RAW parsed config (post-decode, pre-typing) inside the CLI's validate
 * command, and a `DataTable` is assignable to this shape, so both callers use
 * one function.
 */
export interface DataTableViewBindings {
  readonly views?: readonly string[]
  readonly kanbanGroupBy?: { readonly field: string }
  readonly dateField?: string
}

/**
 * The two keys the `rowColorField` EXISTENCE rule reads.
 *
 * Structural for the same reason {@link DataTableViewBindings} is: the rule
 * runs against the RAW parsed config inside the CLI's validate command, and a
 * decoded `DataTable` is assignable to this shape too.
 */
export interface DataTableRowColorBinding {
  readonly dataSource?: { readonly table?: string }
  readonly rowColorField?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * Collect every `type: 'data-table'` component anywhere in a parsed config.
 *
 * A deep walk rather than a `pages[].components[]` sweep on purpose: a
 * data-table can sit inside a container, a tab panel or a split pane, and a
 * shallow walk would silently exempt exactly the nested surfaces an author is
 * most likely to get wrong.
 *
 * ONE walk, several typed façades — every raw-config sweep reads a different
 * handful of keys off the same components, and a second traversal is how two
 * sweeps end up disagreeing about which surfaces they cover.
 */
export function collectDataTableComponents(config: unknown): readonly Record<string, unknown>[] {
  if (Array.isArray(config)) return config.flatMap(collectDataTableComponents)
  if (!isRecord(config)) return []
  const self = config['type'] === 'data-table' ? [config] : []
  return [...self, ...Object.values(config).flatMap(collectDataTableComponents)]
}

/** Every data-table in a raw config, typed for the view-type PRESENCE rule. */
export function collectDataTableViewBindings(config: unknown): readonly DataTableViewBindings[] {
  return collectDataTableComponents(config) as readonly DataTableViewBindings[]
}

/** Every data-table in a raw config, typed for the `rowColorField` EXISTENCE rule. */
export function collectDataTableRowColorBindings(
  config: unknown
): readonly DataTableRowColorBinding[] {
  return collectDataTableComponents(config) as readonly DataTableRowColorBinding[]
}
