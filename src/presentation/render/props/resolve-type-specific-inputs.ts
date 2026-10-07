/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { declaredFieldLabel } from '@/presentation/design/field-display'
import { resolveCalendarDateInputs } from './calendar-date-fields'
import { forReader } from './caller-table-inputs'
import { resolveKanbanFooterFieldMeta, withGridBadgeForm } from './option-badge-paints'
import {
  resolveFigureInputsFor,
  type ChartCategoryOptionInput,
} from './resolve-chart-field-context'
import { resolveFieldDisplayMeta, resolveFieldEditMeta } from './resolve-field-cell-meta'
import {
  resolveFieldOptionColors,
  resolveKanbanColumnColors,
  resolveKanbanColumnOptions,
  resolveKanbanSwimlaneOptions,
} from './resolve-option-colors'
import { resolveBoundView } from './view-binding-inputs'
import type { CurrencyDisplayOptions } from '@/domain/kernel/format/currency-format'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'
import type { ViewGroupBy } from '@/domain/models/app/tables/views/group-by'
import type { BadgeForm } from '@/presentation/design/option-chip-paint'

/**
 * Pre-resolved inputs that some component types need lifted to the top-level
 * element props (resolved from `app.tables` by the caller).
 */
export type TypeSpecificResolvedInputs = {
  readonly dataTableTableFields: readonly string[] | undefined
  readonly dataTableFieldMeta: Record<string, unknown> | undefined
  readonly dataTablePermissions: unknown
  /** The grouping of the view a grid is bound to — a grid groups only through a view. */
  readonly dataTableGroupBy?: ViewGroupBy
  readonly kanbanColumnOptions: readonly string[] | undefined
  readonly kanbanColumnColors: Readonly<Record<string, string>> | undefined
  /**
   * The lane axis' declared options, resolved from `swimlanes.field`. Carries
   * the same weight `kanbanColumnOptions` does for the column axis: without it
   * a lane can only appear where the data already puts one, which makes both
   * the declared-order rule and `showEmpty` unexpressible.
   */
  readonly kanbanSwimlaneOptions: readonly string[] | undefined
  /**
   * `optionValue → #RRGGBB` for the field a record view's `colorField` names,
   * so a kanban card / calendar event / timeline bar can paint the colour its
   * AUTHOR declared instead of one the platform invented.
   *
   * Resolved here rather than in the island because `app.tables` is a
   * server-side input: the islands receive records, never the field schema.
   * Absent when the component declares no `colorField`, or when the named
   * field's options declare no colour — the surface then keeps whatever it
   * does today (ruling 5: an opt-in, never a repaint).
   */
  readonly colorFieldColors: Readonly<Record<string, string>> | undefined
  /** A chart's category options and a chart or KPI's plotted-field currency — see
   * `resolve-chart-field-context.ts`. Absent for every other component type. */
  readonly categoryOptions?: readonly ChartCategoryOptionInput[]
  readonly valueCurrency?: CurrencyDisplayOptions
  readonly aggregateRead?: boolean // figures from one aggregate read, not a page of records
  /** A calendar's day-valued fields, and its fields declaring a `timeZone`. */
  readonly dateOnlyFields?: readonly string[]
  readonly fieldTimeZones?: Readonly<Record<string, string>>
}

const EMPTY_RESOLVED: TypeSpecificResolvedInputs = {
  dataTableTableFields: undefined,
  dataTableFieldMeta: undefined,
  dataTablePermissions: undefined,
  kanbanColumnOptions: undefined,
  kanbanColumnColors: undefined,
  kanbanSwimlaneOptions: undefined,
  colorFieldColors: undefined,
}

/**
 * Resolve the table referenced by a component's `dataSource` from `app.tables`.
 *
 * Exported for `resolve-record-drawer-fields.ts`, which needs the identical
 * `dataSource → app.tables` lookup and must not grow a second copy of it.
 */
export function resolveSourceTable(
  component: Component,
  tables: Tables | undefined
): Tables[number] | undefined {
  if (!tables || !('dataSource' in component) || !component.dataSource) return undefined
  const sourceTable = (component.dataSource as { readonly table: string }).table
  return tables.find((t) => t.name === sourceTable)
}

/**
 * Resolve the field-name list, field metadata (type/options/required/display)
 * and permissions the data-table island needs from `app.tables`.
 */
/**
 * Extract the client-side config of a `type: 'button'` field: what the button
 * says, what it dispatches, and which rows show it. Returns an empty overlay
 * for every other field type so the caller can spread it unconditionally.
 */
function resolveButtonFieldMeta(field: Tables[number]['fields'][number]): Record<string, unknown> {
  if (field.type !== 'button') return {}
  const button = field as {
    readonly label: string
    readonly action: string
    readonly url?: string
    readonly automation?: string
    readonly visibleWhen?: Readonly<Record<string, unknown>>
  }
  return {
    button: {
      label: button.label,
      action: button.action,
      ...(button.url === undefined ? {} : { url: button.url }),
      ...(button.automation === undefined ? {} : { automation: button.automation }),
      ...(button.visibleWhen === undefined ? {} : { visibleWhen: button.visibleWhen }),
    },
  }
}

/**
 * The field vocabulary of a grid bound to a SYSTEM read endpoint.
 *
 * A system source has no `dataSource.table`, so there is no `app.tables` entry
 * to resolve a field list from — and the filter builder's Field select is
 * populated from exactly that list. The result was an empty select under a live
 * "Add filter" button on every system-source grid, at any data volume: the
 * operator could commit a filter that narrowed nothing, and the grid answered
 * with the same rows.
 *
 * The author's DECLARED COLUMNS are the field vocabulary in that case — they
 * are what the header row already shows, so offering them is offering what the
 * operator can see. Each column's `label` rides along as its display name for
 * the same reason: a Field select naming `automationName` where the header says
 * `Automatisation` asks the operator to translate.
 *
 * Only the fields and their labels are derived. Types, options, permissions and
 * views stay absent — an endpoint row has no declared type, and inventing one
 * would put type-specific operators in front of values that may not match.
 */
function resolveSystemSourceColumnInputs(component: Component): TypeSpecificResolvedInputs {
  const source = 'dataSource' in component ? component.dataSource : undefined
  if (!source || !(typeof source === 'object' && 'system' in source)) return EMPTY_RESOLVED

  const columns = ('columns' in component ? component.columns : undefined) as
    ReadonlyArray<{ readonly field?: unknown; readonly label?: unknown }> | undefined
  const declared = (columns ?? []).filter(
    (column): column is { readonly field: string; readonly label?: string } =>
      typeof column.field === 'string' && column.field.length > 0
  )
  if (declared.length === 0) return EMPTY_RESOLVED

  return {
    ...EMPTY_RESOLVED,
    dataTableTableFields: declared.map((column) => column.field),
    dataTableFieldMeta: Object.fromEntries(
      declared.map((column) => [
        column.field,
        typeof column.label === 'string' ? { label: column.label } : {},
      ])
    ),
  }
}

function resolveDataTableInputs(table: Tables[number]): TypeSpecificResolvedInputs {
  return {
    ...EMPTY_RESOLVED,
    dataTableTableFields: table.fields.map((f) => f.name),
    dataTableFieldMeta: Object.fromEntries(
      table.fields.map((f) => {
        const field = f as Readonly<Record<string, unknown>>
        const display = resolveFieldDisplayMeta(field)
        const edit = resolveFieldEditMeta(field)
        return [
          f.name,
          {
            type: f.type,
            // The field's external display name, which titles its auto-generated
            // column header in place of the raw `name`. Read through the shared
            // reader so a `button` field's `label` — its own caption — is not
            // mistaken for one.
            ...(declaredFieldLabel(field) === undefined
              ? {}
              : { label: declaredFieldLabel(field) }),
            ...('options' in f && f.options ? { options: f.options } : {}),
            ...('required' in f && f.required ? { required: true } : {}),
            ...(display ? { display } : {}),
            ...(edit ? { edit } : {}),
            ...resolveButtonFieldMeta(f),
          },
        ]
      })
    ),
  }
}

/**
 * The field a record view colours its records BY, per surface.
 *
 * Each surface is read at the spelling its own renderer reads, so the resolved
 * colour map and the value it is looked up with can never come from two
 * different fields:
 *  - kanban paints from `card.colorField` (`kanban/card-resolvers.ts`);
 *  - calendar from the top-level `colorField` (`calendar/record-to-event.ts`);
 *  - data-timeline from `props.colorField` (`timeline/timeline-compute.ts`);
 *  - data-table from `rowColorField` (`data-table/row-color.ts`), the grid's
 *    own spelling of the same idea — a fourth spelling, deliberately, because
 *    a grid already has a `colorField`-shaped decision per COLUMN and reusing
 *    the bare name there would read as "colour the cells".
 */
function resolveRecordViewColorField(type: string, component: Component): string | undefined {
  const c = component as {
    readonly colorField?: string
    readonly rowColorField?: string
    readonly card?: { readonly colorField?: string }
    readonly props?: { readonly colorField?: string }
  }
  if (type === 'kanban') return c.card?.colorField
  if (type === 'timeline') return c.props?.colorField
  if (type === 'table') return c.rowColorField
  return c.colorField
}

/**
 * The kanban board's four table-derived inputs: both axes' declared options,
 * the column axis' option colours, and the card's `colorField` palette.
 *
 * Its own function so {@link resolveTypeSpecificInputs} stays inside the
 * complexity cap — the board is the only component type needing four of these,
 * and the second axis is what tipped it over.
 */
function resolveKanbanInputs(
  component: Component,
  tables: Tables | undefined,
  form: BadgeForm | undefined
): TypeSpecificResolvedInputs {
  const table = resolveSourceTable(component, tables)
  if (!table) return EMPTY_RESOLVED
  return {
    ...EMPTY_RESOLVED,
    dataTableFieldMeta: resolveKanbanFooterFieldMeta(
      resolveDataTableInputs(table).dataTableFieldMeta,
      table,
      component,
      form
    ),
    kanbanColumnOptions: resolveKanbanColumnOptions(table, component),
    kanbanColumnColors: resolveKanbanColumnColors(table, component),
    kanbanSwimlaneOptions: resolveKanbanSwimlaneOptions(table, component),
    colorFieldColors: resolveFieldOptionColors(
      table,
      resolveRecordViewColorField('kanban', component)
    ),
  }
}

/** A calendar's or a timeline's colour palette, and a calendar's day-valued fields. */
function resolveRecordViewInputs(
  type: 'calendar' | 'timeline',
  component: Component,
  tables: Tables | undefined
): TypeSpecificResolvedInputs {
  const table = resolveSourceTable(component, tables)
  if (!table) return EMPTY_RESOLVED
  return {
    ...EMPTY_RESOLVED,
    colorFieldColors: resolveFieldOptionColors(table, resolveRecordViewColorField(type, component)),
    ...resolveCalendarDateInputs(table, component),
  }
}

/** A chart's or a KPI's field context (`resolve-chart-field-context.ts`). */
function resolveFigureInputs(
  type: 'chart' | 'kpi',
  component: Component,
  tables: Tables | undefined
): TypeSpecificResolvedInputs {
  const table = resolveSourceTable(component, tables)
  if (!table) return EMPTY_RESOLVED
  return { ...EMPTY_RESOLVED, ...resolveFigureInputsFor(type, component, table, tables ?? []) }
}

/**
 * Resolve the type-specific inputs (from `app.tables`) that the element-props
 * builder lifts to the top level for data-table and kanban components.
 *
 * These properties live on the Component object (not in `component.props`) and
 * need forwarding to the island placeholder renderer. For all other types the
 * empty resolved bundle is returned.
 *
 * @param type - The component type literal
 * @param component - The (variable-substituted) component
 * @param tables - The app's tables (used to resolve the referenced table)
 * @returns The resolved inputs consumed by `buildTypeSpecificElementProps`
 */
export function resolveTypeSpecificInputs(
  type: string,
  component: Component,
  tables: Tables | undefined,
  badgeForm?: BadgeForm
): TypeSpecificResolvedInputs {
  if (type === 'table') {
    const table = resolveSourceTable(component, tables)
    if (!table) return resolveSystemSourceColumnInputs(component)
    return {
      // Narrowed to what this grid's READER may see, in ONE place: `caller-table-inputs.ts`.
      ...withGridBadgeForm(
        forReader(resolveDataTableInputs(table), table, component),
        badgeForm,
        component
      ),
      dataTableGroupBy: resolveBoundView(component, table)?.groupBy,
      // The same `colorField` resolver as the three record views.
      colorFieldColors: resolveFieldOptionColors(
        table,
        resolveRecordViewColorField(type, component)
      ),
    }
  }

  if (type === 'kanban') return resolveKanbanInputs(component, tables, badgeForm)

  if (type === 'chart' || type === 'kpi') return resolveFigureInputs(type, component, tables)

  if (type === 'calendar' || type === 'timeline') {
    return resolveRecordViewInputs(type, component, tables)
  }

  return EMPTY_RESOLVED
}
