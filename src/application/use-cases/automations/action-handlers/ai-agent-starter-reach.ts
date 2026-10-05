/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The knowledge an `ai/agent` step of a run started BY HAND may ground on.
 *
 * A run a person starts by hand records who started it, so it has a human
 * caller, as a chat with a declared agent does: the agent's step never shows
 * her more than she may read herself. The automation agent loop runs no record
 * tool, so what the step reads is its knowledge retrieval, and that retrieval
 * is narrowed to what BOTH the agent and the starter may read: the agent's own
 * index (already), and of it only the chunks whose row she may read through the
 * records API's gates — the table's read grant, her row-level read rule — and
 * whose every recorded field she may read. A table chunk that records no field
 * names cannot be judged, and is dropped.
 *
 * A run nobody started by hand (a webhook, a schedule, a record event) keeps
 * the agent's declared reach, and its chunks pass unchanged.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import {
  chunkHoldsOnlyReadable,
  chunkNamesFields,
  rowOfSourceRef,
} from '@/domain/models/app/agents/rag-chunk-read-gate'
import { buildGuestSession } from '../build-guest-session'
import { runReadAccess } from './record-caller-gate'
import type { AutomationContext } from './shared'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { App } from '@/domain/models/app'

/** A retrieved chunk: where it was cut from, and the fields it holds. */
interface RetrievedChunk {
  readonly sourceRef: string | null
  readonly fields?: ReadonlyArray<string> | undefined
}

/** True when the run's starter may read `chunk`'s row and every field it records. */
const starterReadsChunk = (
  app: App,
  automation: AutomationContext,
  chunk: RetrievedChunk
): Effect.Effect<boolean, never, TableRepository | AuthRepository | DataSourceRepository> =>
  Effect.gen(function* () {
    const row = rowOfSourceRef(chunk.sourceRef)
    if (row === undefined) return true
    if (!chunkNamesFields(chunk.fields)) return false
    const access = yield* runReadAccess(app, automation, row.table)
    if (access.kind === 'system') return true
    if (access.kind === 'refused') return false
    if (!chunkHoldsOnlyReadable(chunk.fields, (field) => access.scope.readsColumn(field))) {
      return false
    }
    const repo = yield* TableRepository
    const record = yield* repo.getRecord(buildGuestSession(), row.table, row.recordId).pipe(
      // effect-swallow: a row that cannot be read back cannot be judged, and is withheld from the starter rather than shown.
      Effect.orElseSucceed(() => undefined)
    )
    return record !== undefined && record !== null && access.scope.admits(record)
  })

/**
 * Keep the chunks a hand-started run's starter may read; every chunk of a run
 * nobody started by hand. Judged one chunk at a time: a retrieval is a handful
 * of chunks, and each may cost a row read on the shared pool.
 */
export const chunksWithinStarterReach = <T extends RetrievedChunk>(
  app: App,
  automation: AutomationContext,
  chunks: ReadonlyArray<T>
): Effect.Effect<
  ReadonlyArray<T>,
  never,
  TableRepository | AuthRepository | DataSourceRepository
> =>
  (automation.startedByHand === true
    ? Effect.filter(chunks, (chunk) => starterReadsChunk(app, automation, chunk))
    : Effect.succeed(chunks)
  ).pipe(Effect.withSpan('automations.agent-chunks-within-starter-reach'))
