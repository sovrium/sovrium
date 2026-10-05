/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Effect } from 'effect'
import type { AnnouncedRowChange } from '@/domain/models/app/tables/realtime-announcement-service'

/**
 * The two halves of the live record-change stream's publish side.
 *
 * Every record write — a single create, a batch, an upsert, a restore, a form
 * submission, an automation step, an MCP tool call, and the cascades a delete
 * sets off — commits through the table repositories. So the repositories are
 * where the facts are known: which rows of which tables changed, how, and what
 * they held before and after. The application's write programs are where the
 * app is known, and with it the channel the change belongs on and how a raw row
 * reads as a record. The stream needs both, so it is fed in two steps:
 *
 *  1. a repository write REPORTS each row it committed to the
 *     {@link CommittedRowChanges} collector in scope, after the transaction
 *     commits (a rolled-back write reports nothing);
 *  2. the write program that installed that collector ANNOUNCES what was
 *     reported, once the write is over, through the {@link RecordChangeFeed}.
 *
 * Both are `Context.Reference`s — their defaults do nothing — so a write run
 * outside any announcing scope (a seed from the CLI) costs nothing and needs no
 * extra service. `TableLive` provides the real feed, which is why every runtime
 * that can write a record can also announce it.
 */

/** One row a repository write committed, as the database holds it. */
export interface CommittedRowChange {
  readonly tableName: string
  readonly event: 'insert' | 'update' | 'delete'
  readonly recordId: string
  /** The row as written — present for an insert and an update. */
  readonly row?: Readonly<Record<string, unknown>> | undefined
  /** The row as it stood before the write — present for an update and a delete. */
  readonly previous?: Readonly<Record<string, unknown>> | undefined
}

/** Where a repository write reports the rows it committed. */
export interface RowChangeCollector {
  /** `true` inside an announcing scope; a nested scope then reports to the outer one. */
  readonly active: boolean
  readonly report: (changes: readonly CommittedRowChange[]) => void
}

const IDLE_COLLECTOR: RowChangeCollector = { active: false, report: () => undefined }

/** The collector in scope. Outside any announcing scope, reports go nowhere. */
export const CommittedRowChanges = Context.Reference<RowChangeCollector>(
  'sovrium/CommittedRowChanges',
  { defaultValue: () => IDLE_COLLECTOR }
)

/**
 * Report committed row changes to the collector in scope. Called by a
 * repository write after its transaction commits.
 */
export const reportCommittedRows = (changes: readonly CommittedRowChange[]): Effect.Effect<void> =>
  changes.length === 0
    ? Effect.void
    : Effect.gen(function* () {
        const collector = yield* CommittedRowChanges
        collector.report(changes)
      })

/** What one write announces on one app's change streams. */
export interface RecordWriteAnnouncement {
  /** The app whose channels carry the change (its `name`). */
  readonly appId: string
  readonly changes: readonly AnnouncedRowChange[]
}

/** The publish side of the change stream, as the application sees it. */
export interface RecordChangeFeedShape {
  readonly announce: (announcement: RecordWriteAnnouncement) => Effect.Effect<void>
}

/** The change stream the write programs announce to. `TableLive` provides the live one. */
export const RecordChangeFeed = Context.Reference<RecordChangeFeedShape>(
  'sovrium/RecordChangeFeed',
  { defaultValue: () => ({ announce: () => Effect.void }) }
)
