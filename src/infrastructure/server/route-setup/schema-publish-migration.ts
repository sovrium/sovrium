/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import {
  SchemaMigrator,
  type SchemaMigrationResult,
} from '@/application/ports/services/schema-migrator'
import { SchemaMigratorLive } from '@/infrastructure/database/schema/live-schema-migrator'
import { decodeSnapshotToApp } from './schema-validation'
import type { Snapshot } from './schema-routes-core'

export type PublishMigrationOutcome =
  | { readonly ok: true; readonly result: SchemaMigrationResult }
  | { readonly ok: false; readonly message: string }

export const runPublishMigration = async (
  previousSnapshot: Snapshot | undefined,
  nextSnapshot: Snapshot
): Promise<PublishMigrationOutcome> => {
  const nextApp = decodeSnapshotToApp(nextSnapshot)
  if (nextApp === undefined) {
    return { ok: true, result: { applied: [], deferred: [] } }
  }
  const previousApp = decodeSnapshotToApp(previousSnapshot ?? {}) ?? { name: nextApp.name }

  const program = Effect.gen(function* () {
    const migrator = yield* SchemaMigrator
    return yield* migrator.applyAdditive(previousApp, nextApp)
  }).pipe(Effect.provide(SchemaMigratorLive))

  const exit = await Effect.runPromise(Effect.either(program))
  if (exit._tag === 'Right') {
    return { ok: true, result: exit.right }
  }
  return { ok: false, message: exit.left.message }
}
