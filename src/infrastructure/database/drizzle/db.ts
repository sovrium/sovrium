/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Runtime-specific database driver selection
// Bun runtime uses native bun:sql (db-bun.ts), Node.js runtime uses postgres.js (db-node.ts)
const isBun = typeof Bun !== 'undefined'

// Dynamic import based on runtime
const dbModule = isBun ? './db-bun' : './db-node'
const { db } = await import(dbModule)

export { db }
export type { DrizzleDB } from './db-bun'
