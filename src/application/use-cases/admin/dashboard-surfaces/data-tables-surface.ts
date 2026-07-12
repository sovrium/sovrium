/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { parseDataRoute } from '../dashboard-surface-routes'
import {
  dataObjectFullWidth,
  dataPageEmptyState,
  dataPageIntro,
  firstObjectRedirect,
  objectScopedPage,
  type DataObjectRedirect,
} from './data-object-rail'
import { extractFields, recordGridDataTable, type TableField } from './table-data-surface'
import type { DataShellOptions } from './data-landing-surface'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

const RECORD_DRAWER_ID = 'record-detail-drawer'

type OperatorTable = App['tables'] extends ReadonlyArray<infer T> | undefined ? T : never

function tableNames(tables: ReadonlyArray<OperatorTable>): ReadonlyArray<string> {
  return tables.flatMap((table): ReadonlyArray<string> => {
    const { name } = table as { readonly name?: unknown }
    return typeof name === 'string' ? [name] : []
  })
}

function intro(): Component {
  return dataPageIntro(
    'Enregistrements',
    'Parcourez et éditez les enregistrements de vos tables. Choisissez une table pour ouvrir sa grille — recherchez, triez, filtrez, puis ouvrez une fiche pour la modifier.'
  )
}

function tableGridBody(
  tableName: string,
  fields: ReadonlyArray<TableField>,
  canEdit: boolean
): Component {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-4' },
    children: [
      recordGridDataTable(tableName, fields),
      {
        type: 'record-drawer',
        id: RECORD_DRAWER_ID,
        props: { title: "Détail de l'enregistrement" },
        dataSource: { table: tableName },
        recordFields: fields.map((field) => ({ name: field.name, type: field.type })),
        canEdit,
      },
    ],
  } as unknown as Component
}

function noTablesBody(): Component {
  return dataPageEmptyState(
    'Aucune table',
    'Cette application ne déclare encore aucune table. Ajoutez-en une depuis l’onglet Config pour commencer à saisir des enregistrements.',
    'Une table d’abord, les données suivront.'
  )
}

function tablesBody(
  selected: string,
  selectedTable: OperatorTable | undefined,
  canEdit: boolean
): Component {
  if (selectedTable === undefined) return noTablesBody()
  return dataObjectFullWidth(tableGridBody(selected, extractFields(selectedTable), canEdit))
}

function tablesPage(
  selected: string | undefined,
  body: Component,
  options: DataShellOptions
): Page {
  return objectScopedPage(
    { key: 'tables', label: 'Enregistrements', intro: intro() },
    selected,
    body,
    options
  )
}

export function buildDataTablesPage(
  operatorApp: App,
  selected: string | undefined,
  options: DataShellOptions
): Page | DataObjectRedirect {
  const tables = (operatorApp.tables ?? []) as ReadonlyArray<OperatorTable>
  const names = tableNames(tables)

  if (selected === undefined && names[0] !== undefined) {
    return firstObjectRedirect('tables', names[0])
  }

  const selectedTable = selected
    ? tables.find((t) => (t as { name?: string }).name === selected)
    : undefined
  const body = selected ? tablesBody(selected, selectedTable, options.canEdit) : noTablesBody()

  return tablesPage(selected, body, options)
}

export function recordGridTablesFor(
  operatorApp: App,
  dashboardPath: string
): NonNullable<App['tables']> {
  const dataRoute = parseDataRoute(dashboardPath)
  const selectedTableName = dataRoute?.page === 'tables' ? dataRoute.object : undefined
  const table = selectedTableName
    ? (operatorApp.tables ?? []).find((t) => t.name === selectedTableName)
    : undefined
  return table ? [table] : []
}
