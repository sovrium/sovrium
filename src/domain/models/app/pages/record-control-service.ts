/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The controls drawn on a record that the record itself can hide or disable:
 * a button field (`visibleWhen`, `disabledWhen`), a data-table row action
 * (`visibleWhen`, `disabledWhen`) and a `button` placed under a table binding
 * (`disabledWhen`).
 *
 * The server decides both questions, on the whole stored row, and only the
 * verdict leaves: the record read lists the controls disabled on each record
 * (`_disabled`), and a press that names its record is judged against the same
 * control found in the config, never against anything the page sent.
 *
 * ─── CONTROL IDS ───────────────────────────────────────────────────────────
 *
 * A button field is `field:<name>`. A row action or a record-bound button is
 * `<table>:<page index>:<ordinal>`, the ordinal being its place among the
 * conditioned controls of its page in one depth-first walk of the page's
 * components. The page renderer stamps that id on the node before anything
 * transforms the page ({@link stampControlIds}), and the server finds a control
 * by walking the same raw config ({@link tableControls}), so both read the same
 * id off the same position. A control written inside an `app.components`
 * template is not reached by the walk, and carries no id.
 *
 * Only a control with something to judge gets one: a `disabledWhen`, or a
 * `visibleWhen` on a control that starts an automation.
 */

import {
  satisfiesFieldCondition,
  type FieldCondition,
} from '@/domain/models/app/tables/condition-operators'
import { findDeclaredPage } from './page-path-resolvability'
import type { App } from '@/domain/models/app'

/** The key the page renderer stamps a control id under. */
export const CONTROL_ID_KEY = '_controlId'

/** The key the page renderer stamps the table of a control's record under. */
export const CONTROL_TABLE_KEY = '_controlTable'

/** One conditioned control of a table, as the config declares it. */
export interface RecordControl {
  readonly id: string
  readonly table: string
  /** The automation a press of it starts, when it starts one. */
  readonly automation: string | undefined
  readonly visibleWhen: FieldCondition | undefined
  readonly disabledWhen: FieldCondition | undefined
  readonly disabledReason: string | undefined
}

/** What a control is on one record. */
export type ControlState = 'hidden' | 'disabled' | 'enabled'

type Node = Readonly<Record<string, unknown>>

interface Located {
  readonly path: string
  readonly node: Node
  readonly table: string
}

const isRecord = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const conditionOf = (value: unknown): FieldCondition | undefined =>
  isRecord(value) && typeof value['field'] === 'string' ? (value as FieldCondition) : undefined

const tableOf = (node: Node): string | undefined => {
  const source = node['dataSource']
  return isRecord(source) && typeof source['table'] === 'string' ? source['table'] : undefined
}

const automationOf = (action: unknown): string | undefined =>
  isRecord(action) && action['type'] === 'automation' && typeof action['name'] === 'string'
    ? action['name']
    : undefined

/** Whether a node carries something the server judges on its record. */
const isConditioned = (node: Node): boolean =>
  conditionOf(node['disabledWhen']) !== undefined ||
  (conditionOf(node['visibleWhen']) !== undefined && automationOf(node['action']) !== undefined)

/** The conditioned action items of a table component's action columns. */
const rowActionsOf = (node: Node, path: string, table: string): readonly Located[] => {
  const columns = Array.isArray(node['columns']) ? node['columns'] : []
  return columns.flatMap((column: unknown, columnIndex) => {
    if (!isRecord(column) || !Array.isArray(column['actions'])) return []
    return column['actions'].flatMap((item: unknown, actionIndex) =>
      isRecord(item) && isConditioned(item)
        ? [{ path: `${path}.columns.${columnIndex}.actions.${actionIndex}`, node: item, table }]
        : []
    )
  })
}

/** Keys that never hold a control: the binding itself, a typed action, the action columns. */
const NOT_NESTED: ReadonlySet<string> = new Set(['dataSource', 'action', 'columns'])

/**
 * Every conditioned control under `value`, in depth-first order, each with the
 * table its nearest binding names. `path` is the node's place in the page, in
 * the spelling {@link stampAt} rebuilds along.
 */
const locate = (value: unknown, path: string, table: string | undefined): readonly Located[] => {
  if (Array.isArray(value)) {
    return value.flatMap((entry: unknown, index) => locate(entry, `${path}.${index}`, table))
  }
  if (!isRecord(value)) return []
  const own = tableOf(value)
  const self =
    value['type'] === 'button' && table !== undefined && isConditioned(value)
      ? [{ path, node: value, table }]
      : []
  const rowActions =
    value['type'] === 'table' && own !== undefined ? rowActionsOf(value, path, own) : []
  const below = Object.entries(value)
    .filter(([key]) => !NOT_NESTED.has(key))
    .flatMap(([key, child]) => locate(child, `${path}.${key}`, own ?? table))
  return [...self, ...rowActions, ...below]
}

/** The conditioned controls of one page, each with its id. */
const pageControlsOf = (
  page: unknown,
  pageIndex: number
): readonly (Located & { readonly id: string })[] => {
  if (!isRecord(page)) return []
  return locate(page['components'], 'components', tableOf(page)).map((located, ordinal) => ({
    ...located,
    id: `${located.table}:${String(pageIndex)}:${String(ordinal)}`,
  }))
}

/**
 * The nodes of `page` the walk gives a control id — the very objects of the
 * config, so a caller can tell a conditioned node the walk does not reach
 * (a button whose record is not a table's, one in the page `layout`) by
 * identity.
 */
export const reachedControlNodesOf = (page: unknown): ReadonlySet<unknown> =>
  new Set(pageControlsOf(page, 0).map(({ node }) => node))

/** `value` rebuilt with each node whose path `ids` names carrying its id. */
const stampAt = (
  value: unknown,
  path: string,
  ids: ReadonlyMap<string, { readonly id: string; readonly table: string }>
): unknown => {
  if (Array.isArray(value))
    return value.map((entry, index) => stampAt(entry, `${path}.${index}`, ids))
  if (!isRecord(value)) return value
  const control = ids.get(path)
  const rebuilt = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, stampAt(child, `${path}.${key}`, ids)])
  )
  return control === undefined
    ? rebuilt
    : { ...rebuilt, [CONTROL_ID_KEY]: control.id, [CONTROL_TABLE_KEY]: control.table }
}

/**
 * `page` with every conditioned control carrying its id under
 * {@link CONTROL_ID_KEY}, and the table of the record it is drawn on under
 * {@link CONTROL_TABLE_KEY}. Run on the RAW page, before any pass transforms it,
 * so the ids are the ones {@link tableControls} reads off the config.
 * `pageIndex` is the page's place in `app.pages`. A page with no conditioned
 * control is returned as is.
 */
export const stampControlIds = <P>(page: P, pageIndex: number): P => {
  const controls = pageControlsOf(page, pageIndex)
  if (controls.length === 0 || !isRecord(page)) return page
  const ids = new Map(controls.map(({ path, id, table }) => [path, { id, table }]))
  return { ...page, components: stampAt(page['components'], 'components', ids) } as P
}

/** A located node as a {@link RecordControl}. */
const toControl = (id: string, table: string, node: Node, automation: string | undefined) => ({
  id,
  table,
  automation,
  visibleWhen: conditionOf(node['visibleWhen']),
  disabledWhen: conditionOf(node['disabledWhen']),
  disabledReason: typeof node['disabledReason'] === 'string' ? node['disabledReason'] : undefined,
})

/** The button fields of `table` carrying a condition or starting an automation. */
const buttonFieldControls = (
  tables: readonly unknown[],
  table: string
): readonly RecordControl[] => {
  const declared = tables.find((entry) => isRecord(entry) && entry['name'] === table)
  const fields = isRecord(declared) && Array.isArray(declared['fields']) ? declared['fields'] : []
  return fields.flatMap((field: unknown) => {
    if (!isRecord(field) || field['type'] !== 'button' || typeof field['name'] !== 'string') {
      return []
    }
    const automation =
      field['action'] === 'automation' && typeof field['automation'] === 'string'
        ? field['automation']
        : undefined
    const conditioned =
      conditionOf(field['disabledWhen']) !== undefined ||
      conditionOf(field['visibleWhen']) !== undefined
    // An automation button is listed even with no condition, so its own route
    // finds what it presses; there is then nothing to judge on the record.
    return conditioned || automation !== undefined
      ? [toControl(`field:${field['name']}`, table, field, automation)]
      : []
  })
}

/** Minimal shape needed to list a table's controls. */
interface AppForControls {
  readonly tables?: readonly unknown[]
  readonly pages?: readonly unknown[]
}

/**
 * Every conditioned control drawn on records of `table`: its button fields,
 * then the row actions and record-bound buttons the pages bind to it.
 */
export const tableControls = (app: AppForControls, table: string): readonly RecordControl[] => [
  ...buttonFieldControls(app.tables ?? [], table),
  ...(app.pages ?? []).flatMap((page, pageIndex) =>
    pageControlsOf(page, pageIndex)
      .filter((located) => located.table === table)
      .map(({ id, node }) => toControl(id, table, node, automationOf(node['action'])))
  ),
]

/** The control `id` of `table`, or `undefined` when the config draws none by that id. */
export const findTableControl = (
  app: AppForControls,
  table: string,
  id: string
): RecordControl | undefined => tableControls(app, table).find((control) => control.id === id)

/**
 * What `control` is on `row`, the WHOLE stored row: hidden where its
 * `visibleWhen` does not hold, disabled where its `disabledWhen` does, usable
 * otherwise. An absent `disabledWhen` never disables — it is not handed to
 * {@link satisfiesFieldCondition}, which reads an absent condition as met.
 */
export const controlStateOn = (control: RecordControl, row: Node): ControlState => {
  if (control.visibleWhen !== undefined && !satisfiesFieldCondition(control.visibleWhen, row)) {
    return 'hidden'
  }
  return control.disabledWhen !== undefined && satisfiesFieldCondition(control.disabledWhen, row)
    ? 'disabled'
    : 'enabled'
}

/**
 * The ids of the controls disabled on `row`, in config order: what the record
 * read hands the page as `_disabled`. Judged on the whole stored row, a field
 * the reader may not read included; only the ids leave.
 */
export const disabledControlIds = (
  controls: readonly RecordControl[],
  row: Node
): readonly string[] =>
  controls
    .filter(
      (control) =>
        control.disabledWhen !== undefined && satisfiesFieldCondition(control.disabledWhen, row)
    )
    .map((control) => control.id)

/**
 * A matched page with its control ids stamped ({@link stampControlIds}), or the
 * match as is when its page is not one of `pages` (a page the engine
 * synthesised carries no conditioned control of the config's).
 */
export const withDeclaredControlIds = <F extends { readonly page: unknown }>(
  pages: readonly unknown[] | undefined,
  found: F | undefined
): F | undefined => {
  if (found === undefined) return undefined
  const index = (pages ?? []).indexOf(found.page)
  return index < 0 ? found : { ...found, page: stampControlIds(found.page, index) }
}

/**
 * The declared page `path` names, with its control ids stamped — what a page
 * render starts from, before any pass expands or transforms the page, so the
 * ids are the ones the server reads off the config.
 */
export const findStampedDeclaredPage = (app: App, path: string) =>
  withDeclaredControlIds(app.pages, findDeclaredPage(app, path))
