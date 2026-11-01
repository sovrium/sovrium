/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import {
  Database,
  DatabaseUnownedLive,
  type DatabaseService,
} from '@/infrastructure/database/drizzle/layer'
import { StorageServiceLive } from '@/infrastructure/storage/storage-service-live'

/**
 * The database a seed run reads and writes. A seed runs with no server runtime
 * of its own — `sovrium seed`, `sovrium import --apply`, or a server's
 * self-seed step handed off a request — so it reads the unowned database, which forwards
 * to the client a running server owns, or to the CLI's own.
 */
export const seedDatabase = (): DatabaseService =>
  Effect.runSync(Effect.provide(Database, DatabaseUnownedLive))

/** The storage a seed run stores its files in, its catalog on that same database. */
export const SeedStorageLive = Layer.provide(StorageServiceLive, DatabaseUnownedLive)
