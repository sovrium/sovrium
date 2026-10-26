/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { withInheritedCurrency } from '@/domain/models/app/tables/rollup-currency-service'
import { declaredFieldLabel } from '@/presentation/design/field-display'
import {
  resolveFieldDisplayMeta,
  resolveFieldEditMeta,
  rollupResultMeta,
} from './resolve-field-cell-meta'
import type { TypeSpecificResolvedInputs } from './resolve-type-specific-inputs'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'

/**
 * The resolved bundle with every table-derived input absent — what a component
 * type needing none of them, or a source that resolves to no table, receives.
 */
export const EMPTY_RESOLVED: TypeSpecificResolvedInputs = {
  dataTableTableFields: undefined,
  dataTableFieldMeta: undefined,
  dataTablePermissions: undefined,
  kanbanColumnOptions: undefined,
  kanbanColumnColors: undefined,
  kanbanSwimlaneOptions: undefined,
  colorFieldColors: undefined,
}

/**
 * Extract the client-side config of a `type: 'button'` field: what the button
 * says, what it dispatches, and which rows show it. Returns an empty overlay
 * for every other field type so the caller can spread it unconditionally.
 */
export function resolveButtonFieldMeta(
  field: Tables[number]['fields'][number]
): Record<string, unknown> {
  if (field.type !== 'button') return {}
  const button = field as {
    readonly label: string
    readonly action: string
    readonly url?: string
    readonly automation?: string
    readonly visibleWhen?: Readonly<Record<string, unknown>>
    readonly disabledReason?: string
  }
  // The `disabledWhen` itself stays on the server: the grid draws the verdict
  // the record read carries (`_disabled`), and only the reason is shown.
  return {
    button: {
      label: button.label,
      action: button.action,
      ...(button.url === undefined ? {} : { url: button.url }),
      ...(button.automation === undefined ? {} : { automation: button.automation }),
      ...(button.visibleWhen === undefined ? {} : { visibleWhen: button.visibleWhen }),
      ...(button.disabledReason === undefined ? {} : { disabledReason: button.disabledReason }),
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
 * would put type-specific operators in front of values that may not match. The
 * one exception is a column the SERVER derived from a declaration that does
 * type it: a form's answer column carries its field's type (`_fieldType`), so
 * the grid draws the answer with that type's cell.
 */
export function resolveSystemSourceColumnInputs(component: Component): TypeSpecificResolvedInputs {
  const source = 'dataSource' in component ? component.dataSource : undefined
  if (!source || !(typeof source === 'object' && 'system' in source)) return EMPTY_RESOLVED

  const columns = ('columns' in component ? component.columns : undefined) as
    | ReadonlyArray<{
        readonly field?: unknown
        readonly label?: unknown
        readonly _fieldType?: unknown
      }>
    | undefined
  const declared = (columns ?? []).filter(
    (
      column
    ): column is {
      readonly field: string
      readonly label?: string
      readonly _fieldType?: string
    } => typeof column.field === 'string' && column.field.length > 0
  )
  if (declared.length === 0) return EMPTY_RESOLVED

  return {
    ...EMPTY_RESOLVED,
    dataTableTableFields: declared.map((column) => column.field),
    dataTableFieldMeta: Object.fromEntries(
      declared.map((column) => [
        column.field,
        {
          ...(typeof column.label === 'string' ? { label: column.label } : {}),
          ...(typeof column._fieldType === 'string' ? { type: column._fieldType } : {}),
        },
      ])
    ),
  }
}

/**
 * Resolve the field-name list, field metadata (type/options/required/display)
 * and permissions the data-table island needs from `app.tables`.
 */
export function resolveDataTableInputs(
  table: Tables[number],
  tables: Tables | undefined
): TypeSpecificResolvedInputs {
  return {
    ...EMPTY_RESOLVED,
    dataTableDeclaresViews: (table.views?.length ?? 0) > 0,
    dataTableNames: {
      name: table.name,
      ...(table.label !== undefined && { label: table.label }),
      ...(table.labelPlural !== undefined && { labelPlural: table.labelPlural }),
    },
    dataTableTableFields: table.fields.map((f) => f.name),
    dataTableFieldMeta: Object.fromEntries(
      table.fields.map((f) => {
        const field = f as Readonly<Record<string, unknown>>
        // A rollup over a `currency` field displays in that field's currency.
        const display = resolveFieldDisplayMeta(withInheritedCurrency(f, table, tables ?? []))
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
            ...rollupResultMeta(f, table, tables ?? []),
            ...resolveButtonFieldMeta(f),
          },
        ]
      })
    ),
  }
}

/**
 * The fields a CSV import maps onto, and their meta: the same vocabulary a grid
 * bound to the table offers, read for an `openImport` button.
 */
export function resolveTableImportFields(
  table: Tables[number],
  tables: Tables | undefined
): {
  readonly tableFields: readonly string[]
  readonly fieldMeta: Record<string, unknown>
} {
  const inputs = resolveDataTableInputs(table, tables)
  return {
    tableFields: inputs.dataTableTableFields ?? [],
    fieldMeta: inputs.dataTableFieldMeta ?? {},
  }
}
