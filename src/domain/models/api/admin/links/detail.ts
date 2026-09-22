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

import { Schema } from 'effect'
import { adminLinkSchema } from './catalog'

/**
 * One candidate destination, as the console renders it.
 *
 * `index` is the attribution key recorded on every click event — including for a
 * single-destination link, so an A/B report added later can read back through
 * data that predates it.
 */
export const adminLinkTargetSchema = Schema.Struct({
  index: Schema.Int.annotate({
    description: 'Position in the target list. Recorded on each click event as `targetIndex`.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  to: Schema.String.annotate({ description: 'Destination URL or app-relative path.' }),
  weight: Schema.Int.annotate({
    description: 'Relative share of traffic in a weighted rotation. 1 when unweighted.',
  }).pipe(Schema.check(Schema.isGreaterThan(0))),
}).annotate({ identifier: 'AdminLinkTarget' })

/**
 * The campaign parameters a link appends at redirect time.
 *
 * Every field nullable rather than optional: the console renders a fixed set of
 * rows, and a missing key and an unset key would otherwise render differently
 * for no reason an operator could explain.
 */
export const adminLinkUtmSchema = Schema.Struct({
  source: Schema.NullOr(Schema.String.annotate({ description: 'Appended as utm_source.' })),
  medium: Schema.NullOr(Schema.String.annotate({ description: 'Appended as utm_medium.' })),
  campaign: Schema.NullOr(Schema.String.annotate({ description: 'Appended as utm_campaign.' })),
  content: Schema.NullOr(Schema.String.annotate({ description: 'Appended as utm_content.' })),
  term: Schema.NullOr(Schema.String.annotate({ description: 'Appended as utm_term.' })),
}).annotate({ identifier: 'AdminLinkUtm' })

/**
 * Response schema for `GET /api/admin/links/:slug`.
 */
export const adminLinkDetailResponseSchema = Schema.Struct({
  link: Schema.Struct({
    ...adminLinkSchema.fields,
    targets: Schema.Array(adminLinkTargetSchema)
      .annotate({
        description:
          'Every candidate destination. A link declared with the single-destination `to` shorthand reports a one-element list here, because the resolver normalises both forms through one helper.',
      })
      .pipe(Schema.check(Schema.isMinLength(1))),
    utm: Schema.NullOr(
      adminLinkUtmSchema.annotate({ description: 'Campaign parameters, or null when none.' })
    ),
    notes: Schema.NullOr(
      Schema.String.annotate({
        description: 'Operator notes. Shown in the console only, never on a public path.',
      })
    ),
    expiredTo: Schema.NullOr(
      Schema.String.annotate({
        description:
          'Where a dead link redirects instead of answering 410. Null means it answers 410 Gone.',
      })
    ),
    qrUrl: Schema.String.annotate({
      description:
        'Where this link’s QR image is served (e.g. "/l/spring-promo.svg"). Public and immutably cacheable.',
    }),
  }).annotate({
    title: 'sovrium:extends=AdminLink|own=targets,utm,notes,expiredTo,qrUrl',
    identifier: 'AdminLinkDetail',
  }),
}).annotate({ identifier: 'AdminLinkDetailResponse' })

/**
 * TypeScript type for the detail response
 * @public
 */
export type AdminLinkDetailResponse = typeof adminLinkDetailResponseSchema.Type
