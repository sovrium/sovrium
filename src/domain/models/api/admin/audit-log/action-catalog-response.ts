/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { auditActionSchema } from './action-catalog'

/**
 * Single action descriptor returned by `GET /api/admin/audit-log/actions`.
 *
 * The catalog endpoint enumerates every audit action the server emits. The
 * dashboard uses it to populate filter dropdowns without hard-coding the list
 * client-side. `category` is derived from the action's first dot-segment so
 * UIs can group actions naturally (`auth`, `record`, `automation`, …).
 */
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

/**
 * Response shape for `GET /api/admin/audit-log/actions`.
 *
 * Returns the full catalog in stable order so dashboards can rely on the
 * sequence for cache keys. The `total` field is informational — clients
 * should iterate `items` rather than reading `total` separately.
 */
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

/** @public */
export type ActionDescriptor = z.infer<typeof actionDescriptorSchema>
/** @public */
export type ActionCatalogResponse = z.infer<typeof actionCatalogResponseSchema>
