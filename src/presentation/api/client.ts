/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { hc } from 'hono/client'
import type { chainRecordRoutesMethods } from '@/presentation/api/routes/tables/record-routes'

/**
 * Narrowed RPC type for table record operations only.
 *
 * The full `ApiType` (all chained routes + middleware) exceeds TypeScript's
 * instantiation depth limit, causing `hc<ApiType>()` to return `unknown`.
 * This narrower type resolves cleanly.
 */
type RecordRoutesType = ReturnType<typeof chainRecordRoutesMethods>

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
