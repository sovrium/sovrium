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
import { buildEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import {
  CANONICAL_READ_POLICY,
  resolveColumnWhitelist,
} from '@/domain/models/app/tables/read-access-plan-service'
import { withStringRelationshipValues } from '@/domain/models/app/tables/record-id-service'
import { callersOfRow, type RowGrants } from '@/domain/models/app/tables/row-read-admission-service'
import type { App } from '@/domain/models/app'
import type { Table } from '@/domain/models/app/tables/table'

/** A subscriber as a list of the table reads her: her own role and her groups. */
export interface StreamReader {
  readonly role: string
  readonly groups: readonly string[]
}

/**
 * The columns `reader` reads on `table` holding `role`, her groups kept — the
 * records list's field rules for that role, never a role she holds elsewhere
 * (`undefined`: every column).
 */
const readerColumnsOf = (
  app: App,
  table: Table,
  reader: StreamReader,
  role: string = reader.role
): readonly string[] | undefined =>
  resolveColumnWhitelist(
    app,
    table,
    { role, effectiveRoles: buildEffectiveRoles(role, reader.groups), isAuthenticated: true },
    CANONICAL_READ_POLICY
  )

/**
 * The columns a change event may carry to a subscriber holding `role`: those
 * {@link readerColumnsOf} gives her, less the lookups the stream withholds
 * from her ({@link lookupsWithheldFromStream}) — a lookup into a related table
 * or field she may not read, and a lookup the records API judges against the
 * linked records, which an in-memory judgement cannot do.
 */
const streamColumnsOf = (
  app: App,
  table: Table,
  reader: StreamReader,
  role: string
): readonly string[] | undefined => {
  const columns = readerColumnsOf(app, table, reader, role)
  // Subscribing needs a session: a subscriber is never a signed-out visitor.
  const withheld = new Set(
    lookupsWithheldFromStream(app, table.name, { role, groups: reader.groups, signedOut: false })
  )
  if (withheld.size === 0) return columns
  return (columns ?? table.fields.map((field) => field.name)).filter(
    (column) => !withheld.has(column)
  )
}

/**
 * The columns a change may carry to one subscriber, decided row by row as a
 * list of the table decides them: her own role's, and on a row a grant names
 * the columns of each role that grant gives her there (`callersOfRow`). The
 * grants are those `readerRowsOf` reads — on a table of `auth.scopeTables`
 * only — so a role held through a grant on another table opens nothing here.
 */
export interface RowStreamColumns {
  readonly reader: StreamReader
  readonly grants: RowGrants
  /** The columns her own role reads (`undefined`: every column). */
  readonly own: readonly string[] | undefined
  /**
   * The declared columns each role a grant gives her reads, resolved once per
   * connection: added to {@link own}, they open those columns and no other.
   */
  readonly byRole: ReadonlyMap<string, readonly string[]>
  /**
   * Every declared column of the table — what "every column" means on the
   * wire. A record's `fields` in a list hold declared columns only (the
   * system columns ride beside them), so a change, whose previous version is
   * read off the stored row, is held to the same.
   */
  readonly declared: readonly string[]
}

/** Resolve {@link RowStreamColumns} for a subscriber, at the handshake. */
export const rowStreamColumnsOf = (
  app: App,
  table: Table,
  reader: StreamReader,
  grants: RowGrants
): RowStreamColumns => {
  const roles = [...new Set([...grants.values()].flat())]
  const declared = table.fields.map((field) => field.name)
  return {
    reader,
    grants,
    own: streamColumnsOf(app, table, reader, reader.role),
    byRole: new Map(
      roles.map((role) => [role, streamColumnsOf(app, table, reader, role) ?? declared])
    ),
    declared,
  }
}

/** The id of the row a change event is about. */
const changedRowId = (event: Readonly<Record<string, unknown>>): unknown => {
  if (event['recordId'] !== undefined) return event['recordId']
  const record = event['record'] ?? event['oldRecord']
  return record !== null && typeof record === 'object' ? (record as { id?: unknown }).id : undefined
}

/**
 * The columns the change `event` may carry to the subscriber: every column
 * any role she reads its row under reads — never more than the declared ones.
 */
const changeColumnsOf = (
  columns: RowStreamColumns,
  event: Readonly<Record<string, unknown>>
): readonly string[] => {
  const sets = callersOfRow(columns.reader, columns.grants, changedRowId(event)).map((caller) =>
    caller === columns.reader ? columns.own : columns.byRole.get(caller.role)
  )
  if (sets.includes(undefined)) return columns.declared
  return [...new Set(sets.flatMap((set) => set ?? []))]
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

/** The change `event` cut down to the columns its row may show the subscriber ({@link changeColumnsOf}). */
export const readableChange = (
  columns: RowStreamColumns,
  event: Record<string, unknown>
): Record<string, unknown> => applyFieldSelection(event, changeColumnsOf(columns, event))

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
