/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a record-change subscription carries to one subscriber: which columns
 * the stream may show them, and how a change event's record payloads are cut
 * down to those columns and to the subscriber's own `?fields=` selection.
 * The row itself is judged first, by `scopeChangeToReader`; this module only
 * shapes what a delivered event says. Consumed by `subscribe-handlers.ts`.
 */

import { lookupsWithheldFromStream } from '@/application/use-cases/tables/hidden-lookup-omission'
import { withStringRelationshipValues } from '@/domain/models/app/tables/record-id-service'
import type { App } from '@/domain/models/app'
import type { ReadAccessPlan } from '@/domain/models/app/tables/read-access-plan-service'
import type { Table } from '@/domain/models/app/tables/table'

/**
 * The columns a change event may carry to a subscriber: the plan's readable
 * columns, less the lookups the stream withholds from them
 * ({@link lookupsWithheldFromStream}) — a lookup into a related table or field
 * they may not read, and a lookup the records API judges against the linked
 * records, which an in-memory judgement cannot do.
 */
export const streamColumnsOf = (
  app: App,
  table: Table,
  plan: ReadAccessPlan,
  reader: { readonly role: string; readonly groups?: readonly string[] }
): readonly string[] | undefined => {
  // Subscribing needs a session: a subscriber is never a signed-out visitor.
  const withheld = new Set(
    lookupsWithheldFromStream(app, table.name, { ...reader, signedOut: false })
  )
  if (withheld.size === 0) return plan.columnWhitelist
  const readable = plan.columnWhitelist ?? table.fields.map((field) => field.name)
  return readable.filter((column) => !withheld.has(column))
}

/**
 * Apply a column whitelist to a single record payload. `id` is always
 * retained. Returns the payload unchanged when no whitelist was supplied.
 */
const pickRecordFields = (
  payload: unknown,
  whitelist: ReadonlySet<string> | undefined
): unknown => {
  if (!whitelist) return payload
  if (payload === null || typeof payload !== 'object') return payload
  const { id, fields: recordFields } = payload as {
    id?: unknown
    fields?: Record<string, unknown>
  }
  if (recordFields === undefined) return payload
  const filtered = Object.fromEntries(
    Object.entries(recordFields).filter(([key]) => whitelist.has(key))
  )
  return { id, fields: filtered }
}

/**
 * Apply a `fields` whitelist to a change event's record/oldRecord payloads.
 * `id` is always retained. Returns the event unchanged when no whitelist was
 * requested.
 */
export const applyFieldSelection = (
  event: Record<string, unknown>,
  fields: readonly string[] | undefined
): Record<string, unknown> => {
  if (!fields) return event
  const whitelist = new Set(fields)
  return {
    ...event,
    ...(event['record'] !== undefined
      ? { record: pickRecordFields(event['record'], whitelist) }
      : {}),
    ...(event['oldRecord'] !== undefined
      ? { oldRecord: pickRecordFields(event['oldRecord'], whitelist) }
      : {}),
  }
}

/** A record payload `{ id, fields }` with its relationship values read as strings. */
const withStringLinks = (payload: unknown, links: readonly string[]): unknown => {
  if (payload === null || typeof payload !== 'object') return payload
  const { fields } = payload as { readonly fields?: Record<string, unknown> }
  return fields === undefined
    ? payload
    : { ...payload, fields: withStringRelationshipValues(fields, links) }
}

/**
 * A change event whose record and previous record carry relationship values
 * as strings, as the records API answers them. Every publisher but one already
 * sends them so; the AI refinement write-back is started by a database
 * notification that carries no app schema, so the delivery — which knows the
 * table — is the one place that holds for every event.
 */
export const withStringRelationshipLinks = (
  event: Record<string, unknown>,
  links: readonly string[]
): Record<string, unknown> =>
  links.length === 0
    ? event
    : {
        ...event,
        ...(event['record'] !== undefined
          ? { record: withStringLinks(event['record'], links) }
          : {}),
        ...(event['oldRecord'] !== undefined
          ? { oldRecord: withStringLinks(event['oldRecord'], links) }
          : {}),
      }

/**
 * Shape a raw channel event into the wire message for a WebSocket subscriber.
 *
 * `delete` events are reduced to `{ type: 'delete', recordId, table }`.
 * `insert` / `update` events carry the field-permission-filtered record (and
 * previous values, for updates) under the canonical change-event shape.
 */
export const toWebSocketWireMessage = (
  event: Record<string, unknown>,
  readableFields: readonly string[] | undefined
): Record<string, unknown> => {
  if (event['event'] === 'delete') {
    return { type: 'delete', recordId: event['recordId'], table: event['table'] }
  }
  return applyFieldSelection(event, readableFields)
}

/**
 * Parse the optional comma-separated `fields` query param into a field list.
 * Returns `undefined` when no field selection was requested.
 */
export const parseFieldSelection = (raw: string | undefined): readonly string[] | undefined => {
  if (raw === undefined || raw.trim() === '') return undefined
  const fields = raw
    .split(',')
    .map((field) => field.trim())
    .filter((field) => field.length > 0)
  return fields.length > 0 ? fields : undefined
}
