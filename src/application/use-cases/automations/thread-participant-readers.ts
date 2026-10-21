/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Who among a comment thread's people a comment trigger may still name: only
 * those the record's audience admits today — the table's read rule, a records
 * list admitting them the record, its row-level rule — judged by the same
 * {@link selectRecordReaders} that decides who a comment may mention. A person
 * whose grant was withdrawn, or whose role no longer reads the record, is
 * named no more.
 */

import { Effect } from 'effect'
import {
  selectRecordReaders,
  type AudienceRequirements,
} from '@/application/use-cases/tables/comment-mention-programs'
import { logError } from '@/infrastructure/logging/logger'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { App } from '@/domain/models/app'

/** A person of the thread, by account and address. */
export interface ThreadPerson {
  readonly userId: string
  readonly email: string
}

/**
 * The addresses of the `people` the record `recordId` of `tableName` still
 * admits, in their order. A table the app does not declare admits nobody, and
 * an audience that cannot be read admits nobody either (fail closed): the
 * trigger names fewer people, never more.
 */
export const addressesOfRecordReaders = (
  scope: {
    readonly app: App
    readonly tableName: string
    readonly recordId: string
    readonly session: Readonly<UserSession>
  },
  people: readonly ThreadPerson[]
): Effect.Effect<readonly string[], never, AudienceRequirements> =>
  Effect.gen(function* () {
    const table = scope.app.tables?.find((candidate) => candidate.name === scope.tableName)
    if (table === undefined || people.length === 0) return []
    const readers = yield* selectRecordReaders(
      { app: scope.app, table, recordId: scope.recordId, session: scope.session },
      people.map((person) => person.userId)
    ).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() =>
          logError('[automations] reading the thread audience failed; naming nobody', cause, {
            table: scope.tableName,
          })
        )
      ),
      // effect-swallow: failing closed — a trigger that cannot judge the audience names nobody.
      Effect.orElseSucceed(() => [])
    )
    const admitted = new Set(readers.map((reader) => reader.id))
    return people.filter((person) => admitted.has(person.userId)).map((person) => person.email)
  }).pipe(Effect.withSpan('automations.thread-participant-readers'))
