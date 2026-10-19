/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The database step of a boot: migrate — or, when the database cannot be
 * reached, hold the listener on the address the server will take and keep
 * trying until it can.
 *
 * Without this step the boot exits 1 here. Under a supervisor that restarts on failure,
 * that turned a degraded instance into a dead one: the fresh process never
 * bound its port, so the proxy answered 502 for everything and no probe could
 * tell "database down" from "process gone". Holding the port instead keeps
 * the instance visibly alive — every route answers 503, the health routes
 * say `degraded` — and the boot completes IN PLACE, in this process, the
 * moment the database answers. Nothing is migrated, seeded or scheduled
 * before then: every one of those steps runs after this one.
 */

import { Duration, Effect } from 'effect'
import { DatabaseMigrator } from '@/application/ports/services/database-migrator'
import { countDatabaseListeners } from '@/domain/models/app/app-database-listeners-service'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import type { StartOptions } from './start-server-options'
import type {
  DatabaseMigrationError,
  MigrationError,
} from '@/application/ports/services/database-migrator'
import type { ServerFactory } from '@/application/ports/services/server-factory'
import type { App } from '@/domain/models/app'
import type { ServerCreationError } from '@/infrastructure/errors/server-creation-error'
import type { Logger } from '@/infrastructure/logging/logger'
import type { Context } from 'effect'

/** The first retry of an unreachable database waits this long; each one after doubles it. */
const DATABASE_RETRY_BASE_MS = 1000
/** No retry waits longer than this, however many have failed. */
const DATABASE_RETRY_CAP_MS = 30_000

/** The wait before retry number `attempt` (0-based): 1 s, 2 s, 4 s … capped at 30 s. */
const databaseRetryDelayMs = (attempt: number): number =>
  Math.min(DATABASE_RETRY_BASE_MS * 2 ** attempt, DATABASE_RETRY_CAP_MS)

/**
 * Run `migrate` until the database answers.
 *
 * Only a refused CONNECTION is retried. `migrate` opens with one `SELECT 1`
 * and fails as `DatabaseConnectionError` before any DDL when that query does
 * not come back — a stopped PostgreSQL, one still in crash recovery, one not
 * yet accepting connections — so retrying on that tag alone is what keeps a
 * migration from ever running against a half-available database. A
 * `MigrationError` is a real refusal and fails the boot as it always did.
 */
const migrateUntilReachable = (
  migrate: Effect.Effect<void, DatabaseMigrationError>,
  logger: Context.Service.Shape<typeof Logger>,
  attempt: number
): Effect.Effect<void, MigrationError> =>
  migrate.pipe(
    Effect.catchTag('DatabaseConnectionError', (error) => {
      const delayMs = databaseRetryDelayMs(attempt)
      return logger
        .warn(
          `[server] database still unreachable; retrying in ${delayMs / 1000} s (${error.message})`
        )
        .pipe(
          Effect.andThen(Effect.sleep(Duration.millis(delayMs))),
          Effect.andThen(Effect.suspend(() => migrateUntilReachable(migrate, logger, attempt + 1)))
        )
    })
  )

/**
 * Migrate, holding the listener through an unreachable database.
 *
 * Returns the port the held listener bound, so the real bind takes the SAME
 * address rather than resolving `PORT` a second time — a boot with no `PORT`
 * that fell back to an OS-assigned port must not drift to a different one
 * between the degraded phase and the real one. Empty when nothing was held.
 */
export const migrateOrHoldListener = (
  validatedApp: App,
  options: StartOptions,
  serverFactory: Context.Service.Shape<typeof ServerFactory>,
  logger: Context.Service.Shape<typeof Logger>
): Effect.Effect<
  { readonly port?: number },
  DatabaseMigrationError | ServerCreationError,
  DatabaseMigrator
> =>
  Effect.gen(function* () {
    const migrator = yield* DatabaseMigrator
    const migrate = migrator.migrate(parseDatabaseDialectConfig(), {
      listeners: countDatabaseListeners(validatedApp),
    })
    const first = yield* Effect.result(migrate)
    if (first._tag === 'Success') return {}
    if (first.failure._tag !== 'DatabaseConnectionError') return yield* first.failure
    yield* logger.warn(
      `[server] ${first.failure.message}; holding the listener and answering 503 until the database is reachable`
    )
    const held = yield* serverFactory.hold({
      app: validatedApp,
      port: options.port,
      hostname: options.hostname,
    })
    // Released on every exit: a `MigrationError` after the database came back
    // still fails the boot, and it must not fail it with the port still held.
    yield* migrateUntilReachable(migrate, logger, 0).pipe(Effect.ensuring(held.release))
    yield* logger.info('[server] database reachable; completing the boot')
    return held.port === undefined ? {} : { port: held.port }
  }).pipe(Effect.withSpan('server.migrate-or-hold-listener'))
