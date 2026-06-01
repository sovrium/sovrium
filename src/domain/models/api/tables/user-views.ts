/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'


const filterValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
])

const savedViewFilterSchema = z
  .object({
    field: z.string().min(1),
    operator: z.string().min(1),
    value: filterValueSchema,
  })
  .strict()

const savedViewSortSchema = z
  .object({
    field: z.string().min(1),
    direction: z.enum(['asc', 'desc']),
  })
  .strict()

export const userViewPatchSchema = z
  .object({
    name: z.string().min(1).optional(),
    isDefault: z.boolean().optional(),
    filters: z.array(savedViewFilterSchema).optional(),
    sorts: z.array(savedViewSortSchema).optional(),
    fields: z.array(z.string()).optional(),
    groupBy: z.union([z.string(), z.null()]).optional(),
    baseViewId: z.union([z.string(), z.number(), z.null()]).optional(),
  })
  .strict()

export type UserViewPatch = z.infer<typeof userViewPatchSchema>

export const userViewResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  tableName: z.string(),
  isDefault: z.boolean(),
  filters: z.unknown().optional(),
  sorts: z.unknown().optional(),
  fields: z.unknown().optional(),
  groupBy: z.unknown().optional(),
  baseViewId: z.union([z.string(), z.number(), z.null()]).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type UserViewResponse = z.infer<typeof userViewResponseSchema>

export const userViewsListResponseSchema = z.array(userViewResponseSchema)
export type UserViewsListResponse = z.infer<typeof userViewsListResponseSchema>
