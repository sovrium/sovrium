/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/links/:slug`.
 *
 * One link's full DEFINITION — the catalog row plus the fields the list omits
 * for width: the complete target list, the campaign parameters, the operator
 * notes, and the expired-destination fallback.
 *
 * Deliberately carries NO metrics. The per-link console surface reads those from
 * the analytics endpoints with `&event_name={slug}`, so there is exactly one
 * aggregation path over the click store ([internal ref] D6).
 *
 * Source story: [internal ref]
 */

import { z } from '@hono/zod-openapi'
import { adminLinkSchema } from './catalog'

/**
 * One candidate destination, as the console renders it.
 *
 * `index` is the attribution key recorded on every click event — including for a
 * single-destination link, so an A/B report added later can read back through
 * data that predates it.
 */
export const adminLinkTargetSchema = z
  .object({
    index: z
      .number()
      .int()
      .nonnegative()
      .describe('Position in the target list. Recorded on each click event as `targetIndex`.'),
    to: z.string().describe('Destination URL or app-relative path.'),
    weight: z
      .number()
      .int()
      .positive()
      .describe('Relative share of traffic in a weighted rotation. 1 when unweighted.'),
  })
  .openapi('AdminLinkTarget')

/**
 * The campaign parameters a link appends at redirect time.
 *
 * Every field nullable rather than optional: the console renders a fixed set of
 * rows, and a missing key and an unset key would otherwise render differently
 * for no reason an operator could explain.
 */
export const adminLinkUtmSchema = z
  .object({
    source: z.string().nullable().describe('Appended as utm_source.'),
    medium: z.string().nullable().describe('Appended as utm_medium.'),
    campaign: z.string().nullable().describe('Appended as utm_campaign.'),
    content: z.string().nullable().describe('Appended as utm_content.'),
    term: z.string().nullable().describe('Appended as utm_term.'),
  })
  .openapi('AdminLinkUtm')

/**
 * Response schema for `GET /api/admin/links/:slug`.
 */
export const adminLinkDetailResponseSchema = z
  .object({
    link: adminLinkSchema
      .extend({
        targets: z
          .array(adminLinkTargetSchema)
          .min(1)
          .describe(
            'Every candidate destination. A link declared with the single-destination `to` shorthand reports a one-element list here, because the resolver normalises both forms through one helper.'
          ),
        utm: adminLinkUtmSchema.nullable().describe('Campaign parameters, or null when none.'),
        notes: z
          .string()
          .nullable()
          .describe('Operator notes. Shown in the console only, never on a public path.'),
        expiredTo: z
          .string()
          .nullable()
          .describe(
            'Where a dead link redirects instead of answering 410. Null means it answers 410 Gone.'
          ),
        qrUrl: z
          .string()
          .describe(
            'Where this link’s QR image is served (e.g. "/l/spring-promo.svg"). Public and immutably cacheable.'
          ),
      })
      .openapi('AdminLinkDetail'),
  })
  .openapi('AdminLinkDetailResponse')

/**
 * TypeScript type for the detail response
 * @public
 */
export type AdminLinkDetailResponse = z.infer<typeof adminLinkDetailResponseSchema>
