/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Row-scoped delivery of a record change to one subscriber.
 *
 * A table's change stream is published once and fanned out to every open
 * subscription on it. Each subscriber reads the table under its own row-level
 * read rule, so the same change must be judged once per subscriber, against the
 * rows the change carries — in memory, with no database read per event.
 *
 * The contract, for a subscriber whose rule is `reads`:
 *
 *  - an `insert` is delivered when the new row passes;
 *  - an `update` is delivered when the row as changed passes — carrying the row
 *    as it stood only when that passed too, so a row entering view never shows
 *    what it held while it was hidden; when it no longer passes but the row as it
 *    stood did, the subscriber had it on screen, so it is withdrawn as a
 *    `delete` of its id carrying no field at all;
 *  - a `delete` is delivered, without any row payload, when the row passed
 *    before it was deleted;
 *  - a `resync` (a write too large to announce row by row) is delivered,
 *    without the rows it carries for judging, when at least one of them —
 *    as it stood before or after the write — passes;
 *  - anything else is not delivered.
 *
 * A row the event does not carry is judged as not passing. A change that cannot
 * be judged is withheld rather than guessed: withholding costs a subscriber one
 * stale row until the next read, guessing costs the whole row to someone the
 * rule hides it from.
 */

type Row = Readonly<Record<string, unknown>>

/** A change event as the table channel carries it. */
export type ChangeEvent = Readonly<Record<string, unknown>>

/** Whether one row, flattened to `{ id, ...fields }`, is inside the subscriber's read rule. */
export type RowReadRule = (row: Row) => boolean

/** Flatten a `{ id, fields }` payload back into the row a rule reads. */
const rowOf = (payload: unknown): Row | undefined => {
  if (payload === null || typeof payload !== 'object') return undefined
  const { id, fields } = payload as { readonly id?: unknown; readonly fields?: unknown }
  if (fields === null || typeof fields !== 'object') return undefined
  return { ...(fields as Row), id }
}

const passes = (payload: unknown, reads: RowReadRule): boolean => {
  const row = rowOf(payload)
  return row !== undefined && reads(row)
}

/** The event with every row payload removed — what a delete may say. */
const withoutRows = (event: ChangeEvent): ChangeEvent =>
  Object.fromEntries(
    Object.entries(event).filter(([key]) => key !== 'record' && key !== 'oldRecord')
  )

/** The event without the row as it stood — an update bringing a hidden row into view. */
const withoutOldRow = (event: ChangeEvent): ChangeEvent =>
  Object.fromEntries(Object.entries(event).filter(([key]) => key !== 'oldRecord'))

/** An update that takes a visible row out of view, told as the delete of its id. */
const withdrawal = (event: ChangeEvent): ChangeEvent => {
  const { origin: _origin, ...rest } = withoutRows(event)
  return { ...rest, event: 'delete' }
}

/** An `update` for a subscriber whose rule is `reads` — see the module header. */
const scopeUpdate = (event: ChangeEvent, reads: RowReadRule): ChangeEvent | undefined => {
  const wasVisible = passes(event['oldRecord'], reads)
  if (passes(event['record'], reads)) return wasVisible ? event : withoutOldRow(event)
  return wasVisible ? withdrawal(event) : undefined
}

/**
 * The key under which a `resync` notice carries the changed rows, flattened to
 * `{ id, ...fields }`, for each subscriber's rule to be judged on. It never
 * reaches the wire: {@link scopeChangeToReader} strips it.
 */
export const RESYNC_ROWS_KEY = 'rows'

/** A `resync` notice for a subscriber whose rule is `reads` — see the module header. */
const scopeResync = (
  event: ChangeEvent,
  reads: RowReadRule | undefined
): ChangeEvent | undefined => {
  const { [RESYNC_ROWS_KEY]: rows, ...notice } = event
  if (reads === undefined) return notice
  const judged = Array.isArray(rows) ? (rows as readonly unknown[]) : []
  const anyVisible = judged.some(
    (row) => row !== null && typeof row === 'object' && reads(row as Row)
  )
  return anyVisible ? notice : undefined
}

/**
 * The event one subscriber receives for a change, or `undefined` when the
 * change is not theirs to see. See the module header for the contract.
 *
 * `reads` is `undefined` when no row rule governs this subscriber (the table
 * declares none, or the caller is unrestricted): every change is delivered, and
 * a delete is still stripped of the row it carries for judging — the stream
 * never told a delete more than the id it removes.
 */
export const scopeChangeToReader = (
  event: ChangeEvent,
  reads: RowReadRule | undefined
): ChangeEvent | undefined => {
  if (event['type'] === 'resync') return scopeResync(event, reads)
  const kind = event['event']
  if (reads === undefined) return kind === 'delete' ? withoutRows(event) : event
  if (kind === 'insert') return passes(event['record'], reads) ? event : undefined
  if (kind === 'update') return scopeUpdate(event, reads)
  if (kind === 'delete') return passes(event['oldRecord'], reads) ? withoutRows(event) : undefined
  return undefined
}
