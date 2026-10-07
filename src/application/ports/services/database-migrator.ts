/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The schema migrator, as the boot sequence sees it: bring the database up to
 * the shipped migration set for the configured dialect, or refuse the boot.
 */

import { Context, Data, type Effect } from 'effect'
import type { DatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'

/** Error when database connection fails */
export class DatabaseConnectionError extends Data.TaggedError('DatabaseConnectionError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/** Error when migration fails */
export class MigrationError extends Data.TaggedError('MigrationError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/** Either way a migration run can refuse the boot. */
export type DatabaseMigrationError = DatabaseConnectionError | MigrationError

export class DatabaseMigrator extends Context.Service<
  DatabaseMigrator,
  {
    readonly migrate: (
      config: Readonly<DatabaseDialectConfig>
    ) => Effect.Effect<void, DatabaseMigrationError>
  }
>()('DatabaseMigrator') {}
