/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { hc } from 'hono/client'
import type { chainRecordRoutesMethods } from '@/presentation/api/routes/tables/record-routes'
import type { chainTableRoutesMethods } from '@/presentation/api/routes/tables/table-routes'

type RecordRoutesType = ReturnType<typeof chainRecordRoutesMethods>

type TableRoutesType = ReturnType<typeof chainTableRoutesMethods>

export const createRecordsClient = (baseUrl: string) => hc<RecordRoutesType>(baseUrl)

export const createTableClient = (baseUrl: string) => hc<TableRoutesType>(baseUrl)
