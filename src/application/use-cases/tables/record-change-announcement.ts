/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  CommittedRowChanges,
  RecordChangeFeed,
  type CommittedRowChange,
  type RowChangeCollector,
} from '@/application/ports/services/record-change-feed'
import { readStoredValues } from '@/domain/models/app/tables/stored-value-service'
import { transformRecord } from './record-transformer'
import type { App } from '@/domain/models/app'
import type { AnnouncedRowChange } from '@/domain/models/app/tables/realtime-announcement-service'

/**
 * The announcing scope every record write runs in.
 *
 * Every write program — single create, update, delete, restore and permanent
 * delete; batch create, update, delete and restore; upsert — pipes its body
 * through {@link announceRecordWrites}, and every door that writes a record
 * (the records and batch routes, the bulk forms, a form submission, an
 * automation step, an MCP tool, the seed) reaches the database through one of
 * those programs. So a change is announced because it was WRITTEN, not because
 * the route that wrote it remembered to announce it — which is how a batch, an
 * upsert, a restore, a form, an automation and a cascade all used to write rows
 * a live grid never heard of.
 *
 * The repositories report each row they commit (cascaded children included)
 * to the collector this scope installs; when the write is over — however it
 * ends, since a committed row stays committed even if a later step of the same
 * program fails — the reported rows are shaped as records and announced once,
 * so the per-write resync threshold sees the whole write.
 *
 * Scopes nest: an inner program run inside an announcing scope (a batch step of
 * an automation, one row of an automation loop) reports to the OUTER scope, so
 * an automation step is one write however many programs it runs.
 */

/** The row as the change stream carries it: the record's id and its fields, as the records API reads them. */
const asRecordRow = (
  app: App,
  tableName: string,
  row: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const record = transformRecord(row, { app, tableName })
  return { id: record.id, ...record.fields }
}

const toAnnounced = (app: App, change: CommittedRowChange): AnnouncedRowChange => ({
  tableName: change.tableName,
  event: change.event,
  recordId: change.recordId,
  record: change.row === undefined ? undefined : asRecordRow(app, change.tableName, change.row),
  // The row as it stood keeps its columns: each subscriber's read rule is judged
  // on it, and a delete never carries it to the wire. Its boolean fields are
  // read as the records API reads them (a SQLite `1`/`0` is `true`/`false`), so
  // the rule judges it as it judges a read, and an update's `oldRecord` reaches
  // the subscriber typed on both engines.
  oldRecord:
    change.previous === undefined
      ? undefined
      : readStoredValues(
          app.tables?.find((table) => table.name === change.tableName),
          change.previous
        ),
})

const announceReported = (
  app: App | undefined,
  reported: readonly CommittedRowChange[]
): Effect.Effect<void> =>
  app === undefined || reported.length === 0
    ? Effect.void
    : Effect.gen(function* () {
        const feed = yield* RecordChangeFeed
        yield* feed.announce({
          appId: app.name,
          changes: reported.map((change) => toAnnounced(app, change)),
        })
      })

/**
 * Run a record write in an announcing scope for `app`. See the module header.
 *
 * `app` may be absent only where no change stream exists to announce to (a
 * write run with no app in hand); the rows are then collected and dropped.
 */
export const announceRecordWrites =
  (app: App | undefined) =>
  <A, E, R>(write: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    Effect.gen(function* () {
      const outer = yield* CommittedRowChanges
      if (outer.active) return yield* write
      // The scope's own buffer: the repositories append to it as they commit,
      // from inside the write, and it is read once the write is over.
      // eslint-disable-next-line functional/prefer-immutable-types -- see above
      const reported: CommittedRowChange[] = []
      const collector: RowChangeCollector = {
        active: true,
        // eslint-disable-next-line functional/immutable-data, no-restricted-syntax -- see `reported`
        report: (changes) => void reported.push(...changes),
      }
      return yield* write.pipe(
        Effect.provideService(CommittedRowChanges, collector),
        Effect.onExit(() => announceReported(app, reported))
      )
    }).pipe(Effect.withSpan('tables.announce-record-writes'))
