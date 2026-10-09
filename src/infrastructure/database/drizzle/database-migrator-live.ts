/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { DatabaseMigrator } from '@/application/ports/services/database-migrator'
import { reserveListenerConnections } from '../sql/postgres-connection-budget'
import { runMigrations } from './migrate'

/**
 * Live `DatabaseMigrator` — {@link runMigrations} behind its port, so the boot
 * sequence names the capability rather than the migrator module.
 */
export const DatabaseMigratorLive = Layer.succeed(
  DatabaseMigrator,
  DatabaseMigrator.of({
    migrate: (config, options) =>
      Effect.sync(() => reserveListenerConnections(options?.listeners ?? 0)).pipe(
        Effect.andThen(runMigrations(config))
      ),
  })
)
