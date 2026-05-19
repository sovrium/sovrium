/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'

export const resourceSchema = z
  .object({
    type: z
      .string()
      .describe(
        'Namespaced resource type (dot-separated, e.g. `table.record`, `automation.run`, `bucket.file`). Open string — validated by the action catalog, not by this schema.'
      ),
    id: z
      .string()
      .describe(
        'Resource identifier as a string. Numeric ids (record row ids) are stringified for uniformity; string ids (UUIDs, slugs) pass through unchanged. Audit log is immutable and append-only — even after force-delete the id is preserved here.'
      ),
    name: z
      .string()
      .optional()
      .describe(
        'Human-friendly label for the resource (e.g. table slug, file path, automation name). Optional — present when the resource has a meaningful display name.'
      ),
  })
  .openapi('AuditResource')

export type Resource = z.infer<typeof resourceSchema>
