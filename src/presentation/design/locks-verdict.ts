/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a table's business rules keep a reader from doing to one record, read
 * the same way by every surface that edits one: the edit form, the drawer, the
 * grid, the kanban board and the calendar.
 *
 * The verdict is the server's: a record the records API or a page hands over
 * carries a `_locks` block when its table's rules hold something on it — the
 * fields a lock keeps from changing (`'*'` for all of them), whether it may be
 * deleted, the values a transition lets a field move to, and each lock's
 * message. The rules themselves never reach the client, so there is nothing to
 * evaluate here, only the block to read.
 *
 * It is a hint, not the gate: the record may have changed since it was read,
 * and every save is still judged by the server, whose refusal carries the same
 * message. Modelled on `disabled-verdict.ts`.
 */

type RecordLike = Readonly<Record<string, unknown>> | undefined

/** A field a lock holds on its record, with the lock's message (absent when none). */
export interface LockVerdict {
  readonly reason: string | undefined
}

/** The shape `_locks` arrives in; every member is read defensively (it is JSON). */
interface LocksHint {
  readonly fields?: unknown
  readonly delete?: unknown
  readonly deleteReason?: unknown
  readonly next?: Readonly<Record<string, unknown>>
  readonly reasons?: Readonly<Record<string, unknown>>
}

/** The record's `_locks` hint, or `undefined` when it carries none. */
const locksHintOf = (record: RecordLike): LocksHint | undefined => {
  const block = record?.['_locks']
  return typeof block === 'object' && block !== null ? (block as LocksHint) : undefined
}

const textOr = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

/** The lock holding `field` on `record`, `undefined` when the field may change there. */
export function lockedOnRecord(record: RecordLike, field: string): LockVerdict | undefined {
  const locks = locksHintOf(record)
  const fields = locks?.fields
  if (fields === '*') return { reason: textOr(locks?.reasons?.['*']) }
  if (!Array.isArray(fields) || !fields.includes(field)) return undefined
  return { reason: textOr(locks?.reasons?.[field]) }
}

/**
 * The values a transition rule lets `field` move to from what `record` holds,
 * the current value left out; `undefined` when no transition governs it.
 */
export function nextValuesOf(record: RecordLike, field: string): readonly string[] | undefined {
  const next = locksHintOf(record)?.next?.[field]
  return Array.isArray(next) ? next.filter((value) => typeof value === 'string') : undefined
}

/**
 * The lock closing `record` as a whole (`fields: '*'`), with its message;
 * `undefined` when no lock holds every field.
 */
export function recordLocked(record: RecordLike): LockVerdict | undefined {
  const locks = locksHintOf(record)
  return locks?.fields === '*' ? { reason: textOr(locks.reasons?.['*']) } : undefined
}

/** The lock keeping `record` from being deleted, `undefined` when it may be. */
export function deleteLocked(record: RecordLike): LockVerdict | undefined {
  const locks = locksHintOf(record)
  return locks?.delete === true ? { reason: textOr(locks.deleteReason) } : undefined
}
