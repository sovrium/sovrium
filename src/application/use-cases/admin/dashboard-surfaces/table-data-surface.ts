/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { App } from '@/domain/models/app'
import type { Component } from '@/domain/models/app/pages/components'

export interface TableField {
  readonly name: string
  readonly type: string
  readonly options?: ReadonlyArray<string>
  readonly required?: boolean
}

type OperatorTable = App['tables'] extends ReadonlyArray<infer T> | undefined ? T : never

const RECORD_DRAWER_ID = 'record-detail-drawer'

function readOptions(raw: unknown): ReadonlyArray<string> | undefined {
  if (!Array.isArray(raw)) return undefined
  const choices = raw.filter((opt): opt is string => typeof opt === 'string')
  return choices.length > 0 ? choices : undefined
}

export function extractFields(table: OperatorTable | undefined): ReadonlyArray<TableField> {
  const fields = (table as { readonly fields?: ReadonlyArray<unknown> } | undefined)?.fields ?? []
  return fields.flatMap((field): ReadonlyArray<TableField> => {
    const f = field as {
      readonly name?: unknown
      readonly type?: unknown
      readonly options?: unknown
      readonly required?: unknown
    }
    if (typeof f.name !== 'string' || typeof f.type !== 'string') return []
    const options = readOptions(f.options)
    return [
      {
        name: f.name,
        type: f.type,
        ...(options ? { options } : {}),
        ...(f.required === true ? { required: true } : {}),
      },
    ]
  })
}

export function recordGridDataTable(
  tableName: string,
  fields: ReadonlyArray<TableField>
): Component {
  return {
    type: 'data-table',
    props: {
      'aria-label': `Enregistrements ${tableName}`,
    },
    dataSource: { table: tableName },
    columns: fields.map((field) => ({ field: field.name, label: field.name })),
    search: { enabled: true, placeholder: 'Rechercher dans les lignes…' },
    onRowClick: { action: 'openDrawer', component: RECORD_DRAWER_ID },
    emptyMessage: 'Aucun enregistrement',
  } as unknown as Component
}
