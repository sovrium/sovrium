/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A `record-field` naming a `button` field: the button the grid draws, decided
 * for THIS reader and THIS record before the page ships.
 *
 * A button field stores nothing, so the binding pass hands a record-field no
 * value to draw. This pass, which knows the app and the reader, decides what
 * one draws instead:
 *
 * - nothing, for a reader the field's read permission leaves out — its label
 *   never reaches her page;
 * - nothing, on a record its `visibleWhen` does not admit, judged on the record
 *   as she may read it (a condition on a field hidden from her is not met);
 * - otherwise the `record-field-button` island, which mounts the grid's
 *   `RecordButton` and runs the automation on the page's record — drawn
 *   disabled, with its reason, on a record its `disabledWhen` holds for (the
 *   server's verdict, judged on the whole row). A `url` naming `$record.*`
 *   ships as the finished address, resolved on the record as she may read it.
 *
 * Every other component passes through untouched.
 */

import {
  recordFieldRefsIn,
  substituteRecordVars,
} from '@/domain/models/app/pages/substitute-record-vars'
import {
  callerReaderFromSession,
  callerTableGate,
} from '@/domain/models/app/tables/caller-record-gate-service'
import { satisfiesFieldCondition } from '@/domain/models/app/tables/condition-operators'
import { buttonUrlForReader } from '@/domain/models/app/tables/fields/field-types/advanced/button-url-redaction-service'
import { resolveButtonUrl } from '@/domain/models/app/tables/fields/field-types/advanced/button-url-service'
import { resolveButtonFieldMeta } from '@/presentation/render/props/data-table-field-inputs'
import { entryAsComponent, rewriteComponent, type ComponentEntry } from './component-rewrite'
import { readRecordForCaller } from './record-read-gate'
import type { DataSourceDb } from './data-source-contracts'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'

interface ButtonFieldContext {
  readonly app: App
  readonly session: SessionInfo | undefined
  readonly db: DataSourceDb
}

/** The island mount a record-field becomes, or `null` for one that draws nothing. */
type RecordButtonMount = Readonly<Record<string, unknown>> | null

/** The declared `button` field a record-field names, when it names one. */
function buttonFieldOf(app: App, props: Readonly<Record<string, unknown>>) {
  const table = app.tables?.find((candidate) => candidate.name === props['_recordTable'])
  const field = table?.fields.find((candidate) => candidate.name === props['field'])
  return table !== undefined && field?.type === 'button' ? { table, field } : undefined
}

/** Whether the field's read permission admits this reader. */
function fieldReadable(ctx: ButtonFieldContext, tableName: string, fieldName: string): boolean {
  const gate = callerTableGate(ctx.app, tableName, callerReaderFromSession(ctx.session, ctx.app))
  if (gate.kind === 'refused') return false
  return gate.plan === undefined || !gate.plan.restrictedColumns.has(fieldName)
}

/**
 * Whether drawing the button needs the record: a `visibleWhen` or a
 * `disabledWhen` to judge on it, or a `url` naming one of its fields.
 */
function readsTheRecord(
  field: { readonly disabledWhen?: unknown },
  config: { readonly visibleWhen?: unknown; readonly url?: string }
): boolean {
  return (
    config.visibleWhen !== undefined ||
    field.disabledWhen !== undefined ||
    (config.url !== undefined && recordFieldRefsIn(config.url).length > 0)
  )
}

async function mountOf(
  props: Readonly<Record<string, unknown>>,
  ctx: ButtonFieldContext
): Promise<RecordButtonMount | undefined> {
  const named = buttonFieldOf(ctx.app, props)
  if (named === undefined) return undefined
  const recordId = props['_recordId']
  const { table, field } = named
  if (recordId === undefined || recordId === null) return null
  if (!fieldReadable(ctx, table.name, field.name)) return null
  const config = resolveButtonFieldMeta(field)['button'] as {
    readonly visibleWhen?: Parameters<typeof satisfiesFieldCondition>[0]
    readonly disabledReason?: string
    readonly url?: string
  }
  const mount = { config, field: field.name, table: table.name, recordId: String(recordId) }
  if (!readsTheRecord(field as { readonly disabledWhen?: unknown }, config)) return mount
  const record = await readRecordForCaller({
    ...ctx,
    tableName: table.name,
    at: { field: 'id', value: String(recordId) },
  })
  if (record === undefined) return null
  if (config.visibleWhen !== undefined && !satisfiesFieldCondition(config.visibleWhen, record)) {
    return null
  }
  const finished = withFinishedUrl(config, record)
  if (finished === undefined) return null
  return {
    ...mount,
    config: finished,
    ...disabledOnRecordOf(record, field.name, config.disabledReason),
  }
}

/**
 * The config with its `url` resolved on the record as the reader may read it,
 * so the page receives the finished address: neither a hidden value nor a
 * hidden field's name reaches it. Unchanged when the `url` names no field;
 * `undefined` — no button — when it names only fields she may not read, which
 * are absent from the record she reads.
 */
function withFinishedUrl<C extends { readonly url?: string }>(
  config: C,
  record: Readonly<Record<string, unknown>>
): C | undefined {
  const { url } = config
  if (url === undefined) return config
  const unread = (name: string): boolean => name !== 'id' && !Object.hasOwn(record, name)
  return buttonUrlForReader(url, unread) === undefined
    ? undefined
    : { ...config, url: resolveButtonUrl(url, record) }
}

/**
 * The server's verdict on the button for this record (its id in the record's
 * `_disabled`, judged on the whole row), with its reason read from what the
 * reader may read; nothing when the button is usable.
 */
function disabledOnRecordOf(
  record: Readonly<Record<string, unknown>>,
  fieldName: string,
  reason: string | undefined
): { readonly disabledOnRecord?: { readonly reason: string | undefined } } {
  const listed = record['_disabled']
  if (!Array.isArray(listed) || !listed.includes(`field:${fieldName}`)) return {}
  return {
    disabledOnRecord: {
      reason: reason === undefined ? undefined : substituteRecordVars(reason, record),
    },
  }
}

async function resolveNode(
  entry: ComponentEntry,
  ctx: ButtonFieldContext
): Promise<ComponentEntry> {
  if (typeof entry === 'string') return entry
  const node = entryAsComponent(entry)
  const { children } = node
  const resolved =
    children === undefined
      ? node
      : rewriteComponent(node, { children: await resolveNodes(children, ctx) })
  if (node.type !== 'record-field') return resolved
  const mount = await mountOf(node.props ?? {}, ctx)
  if (mount === undefined) return resolved
  // `data-island` is what tells the page it ships the island runtime.
  const marker = mount === null ? {} : { 'data-island': 'record-field-button' }
  return rewriteComponent(resolved, { props: { ...node.props, ...marker, _recordButton: mount } })
}

const resolveNodes = (
  nodes: readonly ComponentEntry[],
  ctx: ButtonFieldContext
): Promise<readonly ComponentEntry[]> => Promise.all(nodes.map((n) => resolveNode(n, ctx)))

/** Decide the button of every record-field on the page naming a `button` field. */
export async function resolveRecordButtonFields(
  page: Page,
  ctx: ButtonFieldContext
): Promise<Page> {
  if (!page.components || page.components.length === 0) return page
  const components = await resolveNodes(page.components, ctx)
  return { ...page, components: components as Page['components'] }
}
