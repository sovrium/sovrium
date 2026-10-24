/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A record a page binds — a page `dataSource` in single mode, a collection
 * page's record, a component bound in single mode — as the records API reads
 * it for its reader: with the ids it links through each many-to-many field
 * she may read, and the labels her fields read by (`_display`).
 *
 * A many-to-many field has no column on its table: its links live in a
 * junction table, so the row a page reads never carries them. Without this, a
 * `record-field` or a `description-list` entry on the field drew the empty
 * dash and `$record.<field>` resolved to nothing, on a record linking several
 * others.
 */

import { resolveRenderPlan } from './data-source-modes'
import { readableManyToManyFields, withManyToManyLinks } from './form-bound-record'
import { withRecordLabels } from './record-display-labels'
import type { DataSourceDb } from './data-source-contracts'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'

/** Who a bound record is read for, through which database, and from which table. */
interface BoundRecordReader {
  readonly app: App
  readonly session: SessionInfo | undefined
  readonly db: DataSourceDb
  readonly tableName: string
}

/**
 * `record` with the ids it links through each many-to-many field of its table
 * the reader may read, narrowed to the linked rows she may read. Unchanged for
 * a table declaring none, or an undeclared one.
 */
async function withReadableLinks(
  record: Readonly<Record<string, unknown>>,
  reader: BoundRecordReader
): Promise<Readonly<Record<string, unknown>>> {
  const { app, session, tableName } = reader
  const table = app.tables?.find((candidate) => candidate.name === tableName)
  if (table === undefined) return record
  const plan = resolveRenderPlan({ matchedTable: table, app, session })
  const manyToManyFields = readableManyToManyFields(table, { plan, app, session })
  return withManyToManyLinks(record, { ...reader, manyToManyFields })
}

/** `record` with its readable links, then the labels they and its other fields read by. */
export async function withLinksAndLabels(
  record: Readonly<Record<string, unknown>>,
  reader: BoundRecordReader
): Promise<Readonly<Record<string, unknown>>> {
  return withRecordLabels(await withReadableLinks(record, reader), reader)
}

/** {@link withLinksAndLabels} for one reader and table, as a projection of its records. */
export const linksAndLabelsFor =
  (reader: BoundRecordReader) =>
  async (record: Readonly<Record<string, unknown>>): Promise<Readonly<Record<string, unknown>>> =>
    withLinksAndLabels(record, reader)
