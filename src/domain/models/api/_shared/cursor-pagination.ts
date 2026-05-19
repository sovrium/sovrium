/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'


export const cursorPaginationQuerySchema = z.object({
  cursor: z
    .string()
    .optional()
    .describe(
      'Opaque base64 cursor returned in `nextCursor` of the previous response. Omit on first page. Do not parse — format is an internal contract and may change without notice.'
    ),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .describe('Maximum items to return (default 50, max 200)'),
})

export const cursorPaginationResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema).describe('Page of items in descending recency order by default'),
    nextCursor: z
      .string()
      .nullable()
      .describe(
        'Opaque cursor for the next page; null when the stream is fully consumed. Use as `?cursor=...` on the next request.'
      ),
  })

export type CursorPaginationQuery = z.infer<typeof cursorPaginationQuerySchema>
export type CursorPaginationResponse<T> = {
  readonly items: ReadonlyArray<T>
  readonly nextCursor: string | null
}
