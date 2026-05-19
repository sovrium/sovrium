/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { auditActionSchema } from './action-catalog'

const actionDescriptorSchema = z
  .object({
    code: auditActionSchema.describe('Canonical action code (lowercase, dot-separated).'),
    category: z
      .string()
      .describe(
        'Top-level domain derived from the action code (e.g. `auth`, `record`, `automation`). Useful for grouping in dropdowns.'
      ),
  })
  .openapi('AuditActionDescriptor')

export const actionCatalogResponseSchema = z
  .object({
    items: z.array(actionDescriptorSchema).describe('Every audit action the server may emit.'),
    total: z
      .number()
      .int()
      .nonnegative()
      .describe('Total number of action codes (length of `items`).'),
  })
  .openapi('ActionCatalogResponse')

export type ActionDescriptor = z.infer<typeof actionDescriptorSchema>
export type ActionCatalogResponse = z.infer<typeof actionCatalogResponseSchema>
