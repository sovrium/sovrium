/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a record write owes its table's webhooks, and the two calls every write
 * orchestration makes to pay it: {@link withRecordWebhooks} around the write,
 * {@link deliverRecordWebhooks} once the write's record automations are
 * dispatched.
 *
 * The planner turns each committed row change of the written table into one
 * delivery per enabled webhook listening to its event, with the body built
 * NOW — after the webhook's `payload` options — because a delete's row and an
 * update's previous values cannot be rebuilt later. It is pure, so the
 * repository can run it inside the write's transaction (see
 * `record-webhook-dispatcher.ts`).
 *
 * The record a payload carries is the record as the records API reads it —
 * `{ id, ...fields, createdAt, updatedAt }` — for a create, an update and a
 * restore, and the row as it stood for a delete; an update's previous values
 * are the row as it stood. Ids and relationship values read as strings. A
 * field no role or group may read is left out of all of them.
 */

import { Effect } from 'effect'
import {
  RecordWebhookDispatcher,
  type DeliveryMode,
  type OutboxPlanner,
  type PlannedDelivery,
  type RecordWebhookEvent,
} from '@/application/ports/services/record-webhook-dispatcher'
import { withoutFieldsReadByNoOne } from '@/domain/models/app/tables/field-read-filter-service'
import {
  relationshipFieldNames,
  withStringRecordId,
  withStringRelationshipValues,
} from '@/domain/models/app/tables/record-id-service'
import { customizeWebhookData, type Webhook } from '@/domain/models/app/tables/webhooks'
import { serializeDriverRow, transformRecord } from './record-transformer'
import type { CommittedRowChange } from '@/application/ports/services/record-change-feed'
import type { App } from '@/domain/models/app'
import type { Table } from '@/domain/models/app/tables'

/**
 * Which event a committed insert is: a new record, or one brought back from
 * the trash (the repositories report a restore as the insert it reads as on
 * the live stream).
 */
export type WebhookWriteKind = 'write' | 'restore'

type Row = Readonly<Record<string, unknown>>

/** The field types whose values name a user. */
const USER_NAMING_TYPES: ReadonlySet<string> = new Set([
  'user',
  'created-by',
  'updated-by',
  'deleted-by',
])

/** The authorship columns a table may carry without declaring them. */
const AUTHORSHIP_COLUMNS: readonly string[] = ['created_by', 'updated_by', 'deleted_by']

const eventOf = (change: CommittedRowChange, kind: WebhookWriteKind): RecordWebhookEvent => {
  if (change.event === 'insert') return kind === 'restore' ? 'restore' : 'create'
  return change.event
}

/** The user ids one stored value names: a single id, a list, or a JSON list. */
const userIdsIn = (value: unknown): readonly string[] => {
  if (typeof value === 'number') return [String(value)]
  if (Array.isArray(value)) return value.flatMap(userIdsIn)
  if (typeof value !== 'string' || value === '') return []
  if (!value.startsWith('[')) return [value]
  try {
    return userIdsIn(JSON.parse(value) as unknown)
  } catch {
    return [value]
  }
}

/**
 * The users a row change names — in the row as written and as it stood — so
 * erasing one of them removes every delivery about her.
 */
export const subjectsOf = (table: Table, change: CommittedRowChange): readonly string[] => {
  const columns = [
    ...table.fields.filter((field) => USER_NAMING_TYPES.has(field.type)).map((f) => f.name),
    ...AUTHORSHIP_COLUMNS,
  ]
  const rows = [change.row, change.previous].filter((row): row is Row => row !== undefined)
  return [...new Set(rows.flatMap((row) => columns.flatMap((column) => userIdsIn(row[column]))))]
}

const withStringIds = (table: Table, row: Row): Readonly<Record<string, unknown>> => ({
  ...withStringRelationshipValues(withStringRecordId(row), relationshipFieldNames(table)),
})

/** The record a delivery about `change` carries, and the previous values an update compares. */
const recordsOf = (
  app: App,
  table: Table,
  change: CommittedRowChange
): {
  readonly record: Readonly<Record<string, unknown>>
  readonly previousRecord: Readonly<Record<string, unknown>> | undefined
} => {
  const asStored = (row: Row): Readonly<Record<string, unknown>> =>
    withStringIds(table, serializeDriverRow(row, { app, tableName: table.name }))
  const previousRecord = change.previous === undefined ? undefined : asStored(change.previous)
  if (change.row === undefined) return { record: previousRecord ?? {}, previousRecord: undefined }
  const read = transformRecord(change.row, { app, tableName: table.name })
  return {
    record: withStringIds(table, {
      id: read.id,
      ...read.fields,
      createdAt: read.createdAt,
      updatedAt: read.updatedAt,
    }),
    previousRecord,
  }
}

const isListening = (webhook: Webhook, event: RecordWebhookEvent): boolean =>
  webhook.enabled !== false && webhook.events.includes(event)

/** The deliveries one row change owes the webhooks of its table. */
const plannedFor = (
  app: App,
  table: Table,
  change: CommittedRowChange,
  kind: WebhookWriteKind
): readonly PlannedDelivery[] => {
  const event = eventOf(change, kind)
  const listening = (table.webhooks ?? []).filter((webhook) => isListening(webhook, event))
  if (listening.length === 0) return []
  const read = recordsOf(app, table, change)
  // A field no role may read never leaves in a payload: dropped before the
  // webhook's own `includeFields`/`excludeFields`, from the previous values too.
  const record = withoutFieldsReadByNoOne(app, table.name, read.record)
  const previousRecord =
    read.previousRecord === undefined
      ? undefined
      : withoutFieldsReadByNoOne(app, table.name, read.previousRecord)
  const subjects = subjectsOf(table, change)
  const timestamp = new Date().toISOString()
  return listening.map((webhook) => ({
    id: crypto.randomUUID(),
    tableName: table.name,
    webhookName: webhook.name,
    event,
    recordId: change.recordId,
    payload: {
      event: `record.${event}`,
      table: table.name,
      timestamp,
      data: customizeWebhookData({
        record: { ...record },
        payload: webhook.payload,
        event,
        ...(event === 'update' && previousRecord !== undefined
          ? { previousRecord: { ...previousRecord } }
          : {}),
      }),
    },
    subjects,
  }))
}

/**
 * The planner for a write into `tableName`: the deliveries its committed rows
 * owe, as the write commits. A row the write changed in ANOTHER table — a
 * cascade, a cleared link — fires nothing here, as it starts no record
 * automation either.
 */
export const planRecordWebhooks =
  (app: App, tableName: string, kind: WebhookWriteKind): OutboxPlanner =>
  (changes) => {
    const table = app.tables?.find((candidate) => candidate.name === tableName)
    if (table === undefined || (table.webhooks ?? []).length === 0) return []
    return changes
      .filter((change) => change.tableName === tableName)
      .flatMap((change) => plannedFor(app, table, change, kind))
  }

/**
 * Run a write into `tableName` with the deliveries it owes recorded in its own
 * transaction. Resolves to the write's answer and the ids it recorded.
 */
export const withRecordWebhooks =
  (app: App, tableName: string, kind: WebhookWriteKind = 'write') =>
  <A, E, R>(write: Effect.Effect<A, E, R>) =>
    RecordWebhookDispatcher.use((dispatcher) =>
      dispatcher.enqueue(planRecordWebhooks(app, tableName, kind), write)
    ).pipe(Effect.withSpan('tables.with-record-webhooks', { attributes: { tableName } }))

/** Attempt the deliveries a committed write recorded. Never fails. */
export const deliverRecordWebhooks = (
  app: App,
  deliveryIds: readonly string[],
  mode: DeliveryMode
): Effect.Effect<void, never, RecordWebhookDispatcher> =>
  deliveryIds.length === 0
    ? Effect.void
    : RecordWebhookDispatcher.use((dispatcher) =>
        dispatcher.deliver({ app, deliveryIds, mode })
      ).pipe(Effect.withSpan('tables.deliver-record-webhooks', { attributes: { mode } }))
