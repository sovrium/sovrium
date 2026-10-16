/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { chainRecordRoutesMethods } from '@/presentation/api/tables/record-routes'
import type { chainTableRoutesMethods } from '@/presentation/api/tables/table-routes'
import type { chainViewRoutesMethods } from '@/presentation/api/tables/view-routes'
import type { hc } from 'hono/client'

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
 * Narrowed RPC type for the declared-view routes (definition and records).
 */
type ViewRoutesType = ReturnType<typeof chainViewRoutesMethods>

/**
 * The client `hc<T>()` returns for the record routes: the shape every island
 * reads records through. Only the TYPE comes from Hono; the runtime is
 * `createRecordsClient` in `@/presentation/islands/runtime/rpc-client`.
 */
export type RecordsClient = ReturnType<typeof hc<RecordRoutesType>>

/** The client `hc<T>()` returns for the table-level routes (list, get, permissions). */
export type TableClient = ReturnType<typeof hc<TableRoutesType>>

/** The client `hc<T>()` returns for the declared-view routes (definition and records). */
export type ViewRecordsClient = ReturnType<typeof hc<ViewRoutesType>>
