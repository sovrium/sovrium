/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a clickable board plays (`--prototype`), read from the page it draws
 * and the config: each grid with the rows it is drawn with, where each row
 * leads, how it pages, sorts and is searched, and the actions of its row
 * menu; each form placed on the page, with its steps and what it answers once
 * submitted; each button that updates the record the page draws. The canvas
 * adapter turns it into the board's script (`claude-design-canvas-prototype.ts`).
 */

import { pageNodeIdOf, pointerTo } from '@/domain/models/app/pages/node-identity'
import { drawnTableRowsOf, type SeedContext } from './design-system-page-seed'
import type { App } from '@/domain/models/app'
import type {
  BoardPrototype,
  PrototypeField,
  PrototypeForm,
  PrototypeTable,
  PrototypeUpdate,
} from '@/domain/models/app/design/adapters/pages/claude-design-canvas-prototype'
import type { Page } from '@/domain/models/app/pages'

type Node = Readonly<Record<string, unknown>>

/** One node of a page and its id. */
interface PlacedNode {
  readonly id: string
  readonly node: Node
}

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Every node of a page with its id, depth first, through each node's own children. */
const placedNodesOf = (page: Page): readonly PlacedNode[] => {
  const walk = (list: unknown, pointer: string): readonly PlacedNode[] =>
    (Array.isArray(list) ? (list as readonly unknown[]) : []).flatMap((child, index) => {
      if (!isNode(child)) return []
      const at = pointerTo(pointer, index)
      return [
        { id: pageNodeIdOf(page.name, at), node: child },
        ...walk(child['children'], pointerTo(at, 'children')),
      ]
    })
  return walk(page.components, pointerTo('', 'components'))
}

/** An address with each `$record.<field>` read on a row. */
const addressOf = (template: string, row: Readonly<Record<string, unknown>>): string =>
  template.replaceAll(/\$record\.(\w+)/g, (_match, field: string) => String(row[field] ?? ''))

/** The address a row of a grid leads to, as the config writes it. */
const rowTargetOf = (node: Node): string | undefined => {
  const click = node['onRowClick'] as
    { readonly type?: unknown; readonly path?: unknown } | undefined
  return click?.type === 'navigate' && typeof click.path === 'string' ? click.path : undefined
}

/** The actions a grid's action column offers, each with the table it acts on. */
const actionsOf = (node: Node): PrototypeTable['actions'] =>
  (Array.isArray(node['columns']) ? (node['columns'] as readonly Node[]) : []).flatMap((column) =>
    column['type'] !== 'actions' || !Array.isArray(column['actions'])
      ? []
      : (column['actions'] as readonly Node[]).flatMap((entry) => {
          const action = entry['action'] as Node | undefined
          return action?.['type'] === 'crud' && typeof action['table'] === 'string'
            ? [
                {
                  label: String(entry['label'] ?? ''),
                  table: action['table'],
                  operation: String(action['operation'] ?? ''),
                },
              ]
            : []
        })
  )

/** One grid of the board, as the prototype plays it. */
const tableOf = (context: SeedContext, placed: PlacedNode): PrototypeTable => {
  const { node } = placed
  const dataSource = (node['dataSource'] ?? {}) as Node
  const { columns, rows } = drawnTableRowsOf(context, node)
  const target = rowTargetOf(node)
  const pagination = node['pagination'] as { readonly pageSize?: unknown } | undefined
  const actions = actionsOf(node)
  return {
    id: placed.id,
    ...(typeof dataSource['table'] === 'string' ? { table: dataSource['table'] } : {}),
    columns: columns.map((column) => String(column['field'])),
    filter: (Array.isArray(dataSource['filter'])
      ? (dataSource['filter'] as readonly Node[])
      : []
    ).map((condition) => ({
      field: String(condition['field']),
      operator: String(condition['operator']),
      value: condition['value'],
    })),
    ...(typeof pagination?.pageSize === 'number' ? { pageSize: pagination.pageSize } : {}),
    sortable: columns.flatMap((column, at) => (column['sortable'] === true ? [at] : [])),
    ...(typeof dataSource['bindTo'] === 'string' ? { searchBindTo: dataSource['bindTo'] } : {}),
    rowPaths: rows.map((row) => (target === undefined ? undefined : addressOf(target, row))),
    ...(target === undefined ? {} : { recordPath: target }),
    rowMenu: (node['rowActions'] as { readonly display?: unknown } | undefined)?.display === 'menu',
    actions,
  }
}

/** The input type a form field is drawn with. */
const inputTypeOf = (app: App, table: string | undefined, field: Node): string => {
  if (typeof field['inputType'] === 'string') {
    return field['inputType'] === 'email' ? 'email' : 'text'
  }
  const column = (app.tables?.find((candidate) => candidate.name === table)?.fields ?? []).find(
    (candidate) => candidate.name === field['column']
  )
  return column?.type === 'email' ? 'email' : 'text'
}

/** Each field of a form, by the name a step lists it under. */
const formFieldsOf = (app: App, form: Node): ReadonlyMap<string, PrototypeField> => {
  const table = (form['submitTo'] as { readonly table?: string } | undefined)?.table
  return new Map(
    (Array.isArray(form['fields']) ? (form['fields'] as readonly Node[]) : []).map((field) => {
      const name = String(field['column'] ?? field['name'] ?? '')
      return [
        name,
        {
          name,
          label: String(field['label'] ?? name),
          type: inputTypeOf(app, table, field),
          required: field['required'] === true,
        },
      ] as const
    })
  )
}

/** A form's steps, each with its fields, when it has several. */
const stepsOf = (app: App, form: Node): PrototypeForm['steps'] => {
  const fields = formFieldsOf(app, form)
  const steps = Array.isArray(form['steps']) ? (form['steps'] as readonly Node[]) : []
  if (form['layout'] !== 'multi-step' || steps.length < 2) return undefined
  return steps.map((step) => ({
    id: String(step['id']),
    title: String(step['title'] ?? ''),
    fields: (Array.isArray(step['fields']) ? (step['fields'] as readonly string[]) : []).flatMap(
      (field) => fields.get(field) ?? []
    ),
  }))
}

/** What a form answers once submitted: the page it redirects to, or its message. */
const successOf = (form: Node): PrototypeForm['success'] => {
  const success = form['onSuccess'] as Node | undefined
  if (success?.['type'] === 'redirect' && typeof success['url'] === 'string') {
    return { path: success['url'] }
  }
  return typeof success?.['message'] === 'string' ? { message: success['message'] } : undefined
}

/** One form placed on the board, as the prototype plays it. */
const formOf = (app: App, name: string): PrototypeForm | undefined => {
  const form = (app.forms ?? []).find((candidate) => candidate.name === name) as Node | undefined
  if (form === undefined) return undefined
  const steps = stepsOf(app, form)
  const success = successOf(form)
  const writes = (form['submitTo'] as { readonly table?: unknown } | undefined)?.table
  return {
    name,
    ...(steps === undefined ? {} : { steps }),
    ...(success === undefined ? {} : { success }),
    ...(typeof writes === 'string' ? { writes } : {}),
  }
}

/** A button that updates a table's record with fixed values. */
const updateOf = (placed: PlacedNode): PrototypeUpdate | undefined => {
  const action = placed.node['action'] as Node | undefined
  return action?.['type'] === 'crud' &&
    action['operation'] === 'update' &&
    typeof action['table'] === 'string' &&
    isNode(action['data'])
    ? { id: placed.id, table: action['table'], data: action['data'] }
    : undefined
}

/**
 * What one board of a page plays.
 *
 * @param app - the validated config.
 * @param page - the page the board draws.
 * @param context - the seed, account and address the board is drawn at.
 */
export const boardPrototypeOf = (app: App, page: Page, context: SeedContext): BoardPrototype => {
  const placed = placedNodesOf(page)
  return {
    tables: placed
      .filter(({ node }) => node['type'] === 'table' && node['dataSource'] !== undefined)
      .map((entry) => tableOf(context, entry)),
    forms: placed.flatMap(({ node }) => {
      const form = typeof node['formRef'] === 'string' ? formOf(app, node['formRef']) : undefined
      return form === undefined ? [] : [form]
    }),
    updates: placed.flatMap((entry) => updateOf(entry) ?? []),
  }
}
