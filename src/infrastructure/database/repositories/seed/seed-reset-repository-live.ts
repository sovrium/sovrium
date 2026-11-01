/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Live {@link SeedResetRepository}: a reset of the app to its seed, on the
 * `Database` service the composition provides and the app's storage.
 *
 * Every operation is a raw statement — see the port for why a reset never
 * goes through a record program — and the three that must be all-or-nothing
 * (restoring baselines, recording them, rebuilding the organisation) run in
 * one transaction each, opened by `withPromiseTransaction`. Every failure
 * becomes a {@link SeedResetError} carrying the message the step fails with;
 * the statements that touch a baseline never put its values in that message.
 */

import { Effect, Layer } from 'effect'
import {
  SeedResetError,
  SeedResetRepository,
} from '@/application/ports/repositories/seed/seed-reset-repository'
import { StorageService } from '@/application/ports/services/storage-service'
import { Database } from '@/infrastructure/database/drizzle/layer'
import {
  countAppTableRows,
  emptyAppTable,
  eraseAccount,
  readAccounts,
  readHostAdmins,
  readUserRoles,
  setAdminRole,
  setCredentialPassword,
  updateAccountProfile,
} from '@/infrastructure/database/seed-reset-accounts'
import {
  captureBaseline,
  captureFirstBaseline,
  readBaselines,
  recordBaselines,
} from '@/infrastructure/database/seed-reset-baseline'
import { restoreBaselines } from '@/infrastructure/database/seed-reset-baseline-restore'
import {
  clearKeptSignInMaterial,
  clearRecordScopedRows,
  clearUnlinkedOAuthResources,
  countSessions,
  deleteAllSessions,
  referencingText,
  removeFilesNotNamedIn,
} from '@/infrastructure/database/seed-reset-clear'
import { rebuildOrganisation } from '@/infrastructure/database/seed-reset-organisation'
import { authExists, describeFailure } from '@/infrastructure/database/seed-reset-statements'

/** The step's failure, in the words it fails with. */
const failure = (cause: unknown): SeedResetError =>
  new SeedResetError({ message: describeFailure(cause), cause })

/** One Promise-written step as an Effect failing with {@link SeedResetError}. */
const step = <A>(run: () => Promise<A>): Effect.Effect<A, SeedResetError> =>
  Effect.tryPromise({ try: run, catch: failure })

export const SeedResetRepositoryLive = Layer.effect(
  SeedResetRepository,
  Effect.gen(function* () {
    const storage = yield* StorageService
    const database = yield* Database
    return {
      countAppTableRows: (table) => step(() => countAppTableRows(database, table)),
      emptyAppTable: (table, junctions) => step(() => emptyAppTable(database, table, junctions)),
      clearRecordScopedRows: (appTables) => step(() => clearRecordScopedRows(database, appTables)),
      countSessions: step(() => countSessions(database)),
      deleteAllSessions: step(() => deleteAllSessions(database)),
      readAccounts: step(() => readAccounts(database)),
      readHostAdmins: (baselines) => step(() => readHostAdmins(database, baselines)),
      eraseAccount: (userId, app) => step(() => eraseAccount(database, userId, app)),
      updateAccountProfile: (userId, profile) =>
        step(() => updateAccountProfile(database, userId, profile)),
      setAdminRole: (userId) => step(() => setAdminRole(database, userId)),
      setCredentialPassword: (userId, password) =>
        step(() => setCredentialPassword(database, userId, password)),
      clearKeptSignInMaterial: step(() => clearKeptSignInMaterial(database)),
      clearUnlinkedOAuthResources: step(() => clearUnlinkedOAuthResources(database)),
      readBaselines: step(() => readBaselines(database)),
      captureBaseline: (userId) => step(() => captureBaseline(database, userId)),
      captureFirstBaseline: (userId, keptFor) =>
        step(() => captureFirstBaseline(database, userId, keptFor)),
      restoreBaselines: (baselines) => restoreBaselines(database, baselines, failure),
      recordBaselines: (baselines) => recordBaselines(database, baselines, failure),
      organisationExists: step(() => authExists(database, 'organization')),
      readUserRoles: (userIds) => step(() => readUserRoles(database, userIds)),
      rebuildOrganisation: (rebuild) => rebuildOrganisation(database, rebuild, failure),
      removeUnreferencedFiles: step(() => referencingText(database)).pipe(
        Effect.flatMap((text) =>
          removeFilesNotNamedIn(storage, text).pipe(
            Effect.mapError(
              (cause) =>
                new SeedResetError({
                  message: `reset could not remove the unreferenced files: ${describeFailure(cause)}`,
                  cause,
                })
            )
          )
        )
      ),
    }
  })
)
