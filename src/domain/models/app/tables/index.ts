/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Named rather than `export *`: `table.ts` re-exports its own sub-modules
// (`./name`, `./permissions`, …), and starring those through here collides with
// the app-level `./name` in `src/domain/models/app/index.ts`.
export { TableSchema, TablesSchema } from './table'
export type { Table, Tables } from './table'
export { CommentsConfigSchema } from './comments'
export type { CommentsConfig } from './comments'
