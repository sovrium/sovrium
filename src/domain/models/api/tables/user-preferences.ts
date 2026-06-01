/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'


export const rowDensitySchema = z.enum(['compact', 'normal', 'spacious'])

const columnWidthsSchema = z.record(z.string(), z.number().finite().nonnegative())

export const userTablePreferencesPatchSchema = z
  .object({
    rowDensity: rowDensitySchema.optional(),
    columnWidths: columnWidthsSchema.optional(),
    columnOrder: z.array(z.string()).optional(),
    frozenColumns: z.number().int().nonnegative().optional(),
    defaultViewId: z.string().optional(),
  })
  .strict()

export type UserTablePreferencesPatch = z.infer<typeof userTablePreferencesPatchSchema>

export const userTablePreferencesResponseSchema = z.object({
  tableName: z.string(),
  columnWidths: z.unknown().optional(),
  columnOrder: z.unknown().optional(),
  rowDensity: z.string().optional(),
  defaultViewId: z.string().optional(),
  frozenColumns: z.number().optional(),
  updatedAt: z.string().optional(),
})

export type UserTablePreferencesResponse = z.infer<typeof userTablePreferencesResponseSchema>
