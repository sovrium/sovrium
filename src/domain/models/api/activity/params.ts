/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'


export const activityIdParamSchema = z.object({
  activityId: z.string().describe('Activity log identifier'),
})


export const activityQuerySchema = z.object({
  page: z.string().optional().describe('Page number'),
  pageSize: z.string().optional().describe('Items per page'),
  tableId: z.string().optional().describe('Filter by table ID'),
  action: z.enum(['create', 'update', 'delete', 'restore']).optional().describe('Filter by action'),
})
