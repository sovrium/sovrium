/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The display labels a page's bound record carries, under the key the records
 * API gives them (`_display`): a `user` field's person by name, a relationship's
 * linked record by its display field. Attached once, where the page's record is
 * read (`page-parent-resolver.ts`), and read by every surface drawing one field
 * of it — a `description-list` entry and a `record-field` — so the two cannot
 * name the same value differently.
 */

import type { DataSourceDb } from './data-source-contracts'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'

export const RECORD_DISPLAY_KEY = '_display'

/** The labels a bound record carries — the ones `withRecordLabels` gave it — or none. */
export function recordLabelsOf(
  record: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> | undefined {
  const block = record[RECORD_DISPLAY_KEY]
  return typeof block === 'object' && block !== null
    ? (block as Readonly<Record<string, unknown>>)
    : undefined
}

/**
 * What one field of a bound record reads as when it names something else — a
 * to-many link's labels joined — or `undefined` when the record carries no
 * label for it, and the field then reads by its type.
 */
export function recordDisplayOf(
  record: Readonly<Record<string, unknown>>,
  fieldName: unknown
): string | undefined {
  if (typeof fieldName !== 'string') return undefined
  const block = record[RECORD_DISPLAY_KEY]
  if (block === null || typeof block !== 'object') return undefined
  const label = (block as Readonly<Record<string, unknown>>)[fieldName]
  if (typeof label === 'string') return label
  return Array.isArray(label) && label.length > 0 ? label.map(String).join(', ') : undefined
}

/**
 * `record` with the labels the records API gives this reader (`_display`), so
 * a `user` or relationship field reads by name, not by id — each linked
 * record of a many-to-many field by its display field. Unchanged when the
 * database adapter reads no labels.
 */
export async function withRecordLabels(
  record: Readonly<Record<string, unknown>>,
  reader: {
    readonly app: App
    readonly session: SessionInfo | undefined
    readonly db: Pick<DataSourceDb, 'readRecordLabels'>
    readonly tableName: string
  }
): Promise<Readonly<Record<string, unknown>>> {
  const { app, session, db, tableName } = reader
  const labels = await db.readRecordLabels?.(app, tableName, record, session)
  return labels === undefined ? record : { ...record, [RECORD_DISPLAY_KEY]: labels }
}
