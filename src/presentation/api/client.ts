/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { hc } from 'hono/client'
import type { chainRecordRoutesMethods } from '@/presentation/api/routes/tables/record-routes'
import type { chainTableRoutesMethods } from '@/presentation/api/routes/tables/table-routes'

/**
 * Narrowed RPC type for table record operations only.
 *
 * The full `ApiType` (all chained routes + middleware) exceeds TypeScript's
 * instantiation depth limit, causing `hc<ApiType>()` to return `unknown`.
 * This narrower type resolves cleanly.
 */
type RecordRoutesType = ReturnType<typeof chainRecordRoutesMethods>

/**
 * Narrowed RPC type for table-level operations (list, get, permissions).
 */
type TableRoutesType = ReturnType<typeof chainTableRoutesMethods>

/**
 * Create a typed RPC client for table record operations.
 * Uses narrowed types to avoid TypeScript instantiation depth overflow.
 *
 * @example
 * ```typescript
 * const client = createRecordsClient(window.location.origin)
 * const res = await client.api.tables[':tableId'].records.$get({
 *   param: { tableId: 'my-table' },
 *   query: { page: '1', limit: '25' },
 * })
 * ```
 */
export const createRecordsClient = (baseUrl: string) => hc<RecordRoutesType>(baseUrl)

/**
 * Create a typed RPC client for table-level operations.
 *
 * @example
 * ```typescript
 * const client = createTableClient(window.location.origin)
 * const res = await client.api.tables[':tableId'].permissions.$get({
 *   param: { tableId: 'my-table' },
 * })
 * ```
 */
export const createTableClient = (baseUrl: string) => hc<TableRoutesType>(baseUrl)
