/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { DrizzleDB } from './db-bun'

export { db } from './db-bun'
export type { DrizzleDB } from './db-bun'

/**
 * Type for Drizzle transaction callback parameter
 * Extracts the transaction type from the db.transaction method
 */
export type DrizzleTransaction = Parameters<Parameters<DrizzleDB['transaction']>[0]>[0]
