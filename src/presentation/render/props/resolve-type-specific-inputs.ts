/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveCalendarDateInputs } from './calendar-date-fields'
import { forReader } from './caller-table-inputs'
import {
  EMPTY_RESOLVED,
  resolveDataTableInputs,
  resolveSystemSourceColumnInputs,
} from './data-table-field-inputs'
import { resolveKanbanFooterFieldMeta, withGridBadgeForm } from './option-badge-paints'
import {
  resolveFigureInputsFor,
  type ChartCategoryOptionInput,
} from './resolve-chart-field-context'
import {
  resolveFieldOptionColors,
  resolveKanbanColumnColors,
  resolveKanbanColumnOptions,
  resolveKanbanSwimlaneOptions,
  resolveKanbanAxisFields,
} from './resolve-option-colors'
import { resolveBoundView } from './view-binding-inputs'
import type { CurrencyDisplayOptions } from '@/domain/kernel/format/currency-format'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'
import type { TableDisplayNames } from '@/domain/models/app/tables/table-display-name-service'
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
  /** The bound table's names, untranslated — what an empty grid names it by. */
  readonly dataTableNames?: TableDisplayNames
  /** The bound table declares `views[]`, which a grid then offers to switch between. */
  readonly dataTableDeclaresViews?: boolean
  readonly kanbanColumnOptions: readonly string[] | undefined
  readonly kanbanColumnColors: Readonly<Record<string, string>> | undefined
  /**
   * The lane axis' declared options, resolved from `swimlanes.field`. Carries
   * the same weight `kanbanColumnOptions` does for the column axis: without it
   * a lane can only appear where the data already puts one, which makes both
   * the declared-order rule and `showEmpty` unexpressible.
   */
  readonly kanbanSwimlaneOptions: readonly string[] | undefined
  /** The declared fields behind both board axes, read for their option labels. */
  readonly kanbanAxisFields?: ReturnType<typeof resolveKanbanAxisFields>
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
  readonly numericCategories?: true // a chart's categories are numbers, ordered counting up
  readonly aggregateRead?: boolean // figures from one aggregate read, not a page of records
  /** A calendar's day-valued fields, and its fields declaring a `timeZone`. */
  readonly dateOnlyFields?: readonly string[]
  readonly fieldTimeZones?: Readonly<Record<string, string>>
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
      resolveDataTableInputs(table, tables).dataTableFieldMeta,
      table,
      component,
      form
    ),
    kanbanColumnOptions: resolveKanbanColumnOptions(table, component),
    kanbanColumnColors: resolveKanbanColumnColors(table, component),
    kanbanSwimlaneOptions: resolveKanbanSwimlaneOptions(table, component),
    kanbanAxisFields: resolveKanbanAxisFields(table, component),
    colorFieldColors: resolveFieldOptionColors(
      table,
      resolveRecordViewColorField('kanban', component)
    ),
  }
}

/** A calendar's or a timeline's colour palette, and a calendar's day-valued fields. */
function resolveRecordViewInputs(
  type: 'event-calendar' | 'timeline',
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
        forReader(resolveDataTableInputs(table, tables), table, component),
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

  if (type === 'event-calendar' || type === 'timeline') {
    return resolveRecordViewInputs(type, component, tables)
  }

  return EMPTY_RESOLVED
}
