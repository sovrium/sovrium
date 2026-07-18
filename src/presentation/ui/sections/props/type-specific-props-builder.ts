/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveInterpreterString } from '@/domain/utils/translation-resolver'
import { resolveDataTableViews, type ResolvedDataTableView } from './resolve-data-table-views'
import type { Languages } from '@/domain/models/app/languages'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'

export type TypeSpecificResolvedInputs = {
  readonly dataTableTableFields: readonly string[] | undefined
  readonly dataTableFieldMeta: Record<string, unknown> | undefined
  readonly dataTablePermissions: unknown
  readonly dataTableViews: ReadonlyArray<ResolvedDataTableView> | undefined
  readonly kanbanColumnOptions: readonly string[] | undefined
  readonly kanbanColumnColors: Readonly<Record<string, string>> | undefined
}

type BuilderArgs = {
  readonly baseElementPropsWithType: Record<string, unknown>
  readonly component: Component
  readonly componentProps: Component['props']
  readonly resolved: TypeSpecificResolvedInputs
  readonly currentLang?: string
  readonly languages?: Languages
}

const EMPTY_RESOLVED: TypeSpecificResolvedInputs = {
  dataTableTableFields: undefined,
  dataTableFieldMeta: undefined,
  dataTablePermissions: undefined,
  dataTableViews: undefined,
  kanbanColumnOptions: undefined,
  kanbanColumnColors: undefined,
}

function resolveSourceTable(
  component: Component,
  tables: Tables | undefined
): Tables[number] | undefined {
  if (!tables || !component.dataSource) return undefined
  const sourceTable = (component.dataSource as { readonly table: string }).table
  return tables.find((t) => t.name === sourceTable)
}

function resolveDataTableInputs(table: Tables[number]): TypeSpecificResolvedInputs {
  return {
    dataTableTableFields: table.fields.map((f) => f.name),
    dataTableFieldMeta: Object.fromEntries(
      table.fields.map((f) => [
        f.name,
        {
          type: f.type,
          ...('options' in f && f.options ? { options: f.options } : {}),
          ...('required' in f && f.required ? { required: true } : {}),
        },
      ])
    ),
    dataTablePermissions: table.permissions,
    dataTableViews: resolveDataTableViews(
      table.views as ReadonlyArray<Record<string, unknown>> | undefined
    ),
    kanbanColumnOptions: undefined,
    kanbanColumnColors: undefined,
  }
}

type FieldOption = string | { readonly value: string; readonly color?: string }

function resolveKanbanGroupByOptions(
  table: Tables[number],
  component: Component
): readonly FieldOption[] | undefined {
  const groupByField = (component as { kanbanGroupBy?: { field?: string } }).kanbanGroupBy?.field
  if (!groupByField) return undefined
  const groupField = table.fields.find((f) => f.name === groupByField)
  if (groupField && 'options' in groupField && Array.isArray(groupField.options)) {
    return groupField.options as readonly FieldOption[]
  }
  return undefined
}

function resolveKanbanColumnOptions(
  table: Tables[number],
  component: Component
): readonly string[] | undefined {
  const options = resolveKanbanGroupByOptions(table, component)
  return options?.map((opt) => (typeof opt === 'string' ? opt : opt.value))
}

function resolveKanbanColumnColors(
  table: Tables[number],
  component: Component
): Readonly<Record<string, string>> | undefined {
  const options = resolveKanbanGroupByOptions(table, component)
  if (!options) return undefined
  const colored = options.flatMap((opt) =>
    typeof opt === 'string' || !opt.color ? [] : [[opt.value, opt.color] as const]
  )
  return colored.length > 0 ? Object.fromEntries(colored) : undefined
}

export function resolveTypeSpecificInputs(
  type: string,
  component: Component,
  tables: Tables | undefined
): TypeSpecificResolvedInputs {
  if (type === 'data-table') {
    const table = resolveSourceTable(component, tables)
    return table ? resolveDataTableInputs(table) : EMPTY_RESOLVED
  }

  if (type === 'kanban') {
    const table = resolveSourceTable(component, tables)
    return {
      ...EMPTY_RESOLVED,
      kanbanColumnOptions: table ? resolveKanbanColumnOptions(table, component) : undefined,
      kanbanColumnColors: table ? resolveKanbanColumnColors(table, component) : undefined,
    }
  }

  return EMPTY_RESOLVED
}

const TYPE_BUILDERS: Record<string, (args: BuilderArgs) => Record<string, unknown>> = {
  'data-table': ({
    baseElementPropsWithType,
    component,
    componentProps,
    resolved,
    currentLang,
    languages,
  }) => ({
    ...baseElementPropsWithType,
    dataSource: component.dataSource,
    columns: component.columns,
    selection: component.selection,
    pagination: component.pagination,
    search: component.search,
    groupBy: component.groupBy,
    summary: component.summary,
    toolbar: component.toolbar,
    bulkActions: component.bulkActions,
    rowHeight: component.rowHeight,
    striped: component.striped,
    bordered: component.bordered,
    emptyMessage: component.emptyMessage,
    noMatchMessage: component.noMatchMessage,
    showRowNumbers: component.showRowNumbers,
    onRowClick: component.onRowClick,
    autoSave: component.autoSave,
    tableFields: resolved.dataTableTableFields,
    fieldMeta: resolved.dataTableFieldMeta,
    tablePermissions: resolved.dataTablePermissions,
    tableViews: resolved.dataTableViews,
    canCreate: (componentProps as { _canCreate?: boolean } | undefined)?._canCreate,
    newRecordLabel: resolveInterpreterString('datatable.newRecord', currentLang, languages),
  }),

  kanban: ({ baseElementPropsWithType, component, resolved }) => ({
    ...baseElementPropsWithType,
    dataSource: component.dataSource,
    kanbanGroupBy: component.kanbanGroupBy,
    card: component.card,
    drag: component.drag,
    emptyColumnMessage: component.emptyColumnMessage,
    colorField: component.colorField,
    columnOptions: resolved.kanbanColumnOptions,
    columnColors: resolved.kanbanColumnColors,
    search: component.search,
  }),

  calendar: ({ baseElementPropsWithType, component }) => ({
    ...baseElementPropsWithType,
    dataSource: component.dataSource,
    dateField: component.dateField,
    endDateField: component.endDateField,
    defaultView: component.defaultView,
    labelField: component.labelField,
    colorField: component.colorField,
    maxEventsPerDay: component.maxEventsPerDay,
    calendarEvent: component.calendarEvent,
    calendarInteraction: component.calendarInteraction,
    search: component.search,
  }),

  gallery: ({ baseElementPropsWithType, component }) => ({
    ...baseElementPropsWithType,
    dataSource: component.dataSource,
    gridColumns: component.gridColumns,
    galleryCard: component.galleryCard,
    emptyMessage: component.emptyMessage,
    layout: component.layout,
  }),

  chart: ({ baseElementPropsWithType, component }) => ({
    ...baseElementPropsWithType,
    dataSource: component.dataSource,
    chartType: component.chartType,
    xAxis: component.xAxis,
    yAxis: component.yAxis,
    series: component.series,
    legend: component.legend,
    tooltip: component.tooltip,
    chartAggregate: component.chartAggregate,
    emptyMessage: component.emptyMessage,
    emptyState: component.emptyState,
  }),

  kpi: ({ baseElementPropsWithType, component }) => ({
    ...baseElementPropsWithType,
    dataSource: component.dataSource,
    label: component.label,
    kpiAggregate: component.kpiAggregate,
    kpiFormat: component.kpiFormat,
    icon: component.icon,
    trend: component.trend,
    thresholds: component.thresholds,
    sparkline: component.sparkline,
  }),

  'data-timeline': ({ baseElementPropsWithType, component, componentProps }) => ({
    ...baseElementPropsWithType,
    dataSource: component.dataSource,
    startField: componentProps?.startField,
    endField: componentProps?.endField,
    labelField: componentProps?.labelField,
    groupBy: componentProps?.groupBy,
    colorField: componentProps?.colorField,
    defaultZoom: componentProps?.defaultZoom,
    emptyMessage: component.emptyMessage ?? componentProps?.emptyMessage,
  }),

  select: ({ baseElementPropsWithType, component }) => ({
    ...baseElementPropsWithType,
    dataSource: component.dataSource,
    valueField: component.valueField,
    displayField: component.displayField,
  }),

  modal: ({ baseElementPropsWithType, component }) => ({
    ...baseElementPropsWithType,
    id: component.id,
    title: component.title,
    sections: component.sections,
  }),

  input: ({ baseElementPropsWithType, component }) => ({
    ...baseElementPropsWithType,
    ...((component as { inputType?: string }).inputType !== undefined && {
      type: (component as { inputType?: string }).inputType,
    }),
  }),
}

export function buildTypeSpecificElementProps(
  type: string,
  args: BuilderArgs
): Record<string, unknown> {
  const builder = TYPE_BUILDERS[type]
  return builder ? builder(args) : args.baseElementPropsWithType
}
