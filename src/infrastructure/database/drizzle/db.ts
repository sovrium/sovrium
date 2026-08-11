/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { DrizzleDB } from './db-bun'

export { db, getDb, getPgDb, resetDbCache } from './db-bun'
export type { DrizzleDB } from './db-bun'

/**
 * Type for a Drizzle transaction callback parameter.
 *
 * Derived from the `transaction` method of the `DrizzleDB` facade — i.e. the
 * portable transaction surface every repository's `db.transaction(async (tx) => …)`
 * callback receives. In SQLite mode the concrete runtime value is a
 * `bun-sqlite` transaction, structurally compatible for the query-builder
 * subset; raw `tx.execute()` remains Postgres-only.
 */
export type DrizzleTransaction = Parameters<Parameters<DrizzleDB['transaction']>[0]>[0]
