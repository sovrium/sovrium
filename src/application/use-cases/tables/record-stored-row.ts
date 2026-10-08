/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The row as stored, from a written record as the records API answers it.
 *
 * The API shape lifts the system columns out of `fields` — `createdAt`,
 * `updatedAt`, and a `created_by` / `updated_by` column as `createdBy` /
 * `updatedBy` — so a record automation handed `{ id, ...fields }` read
 * `{{trigger.data.record.created_by}}`, `created_at` and `updated_at` as
 * nothing although the row holds them. Every road that starts a record
 * automation hands it this instead: the same row whatever wrote it.
 */

const stamp = (column: string, value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'string' && value !== '' ? { [column]: value } : {}

/**
 * `{ id, ...fields }` with the system columns put back under their column
 * names. A value without a nested `fields` map is already a row: returned as is.
 */
export const storedRowOf = (written: object): Readonly<Record<string, unknown>> => {
  const record = written as Readonly<Record<string, unknown>>
  const { fields } = record
  if (fields === null || typeof fields !== 'object') return { ...record }
  return {
    ...stamp('created_at', record['createdAt']),
    ...stamp('updated_at', record['updatedAt']),
    ...stamp('created_by', record['createdBy']),
    ...stamp('updated_by', record['updatedBy']),
    id: record['id'],
    ...(fields as Readonly<Record<string, unknown>>),
  }
}
