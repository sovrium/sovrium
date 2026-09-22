/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/links`.
 *
 * The catalog of link DEFINITIONS an instance serves at `/l/{slug}` — both the
 * ones declared in `app.links[]` and the ones minted at runtime.
 *
 * **This is the only new read endpoint the Links console needs**, and the reason
 * is worth stating so nobody adds the obvious siblings later. Click metrics do
 * not live here: they are read through the analytics endpoints that already
 * compute them (`/api/analytics/{overview,referrers,devices,campaigns,events}`)
 * with `?event_type=link_click[&event_name={slug}]`. A `/api/admin/links/overview`
 * or `/api/admin/links/:slug/clicks` would be a second aggregation path over the
 * same rows, and the two would eventually disagree. D6.
 *
 * Source story: [internal ref]
 *
 * @see ../../../app/links — the config-side schema this projects
 * @see ./detail.ts — the single-link sibling
 */

import { Schema } from 'effect'
import { coercedBoolean } from '@/domain/models/api/combinators/coerce'
import { looseIsoDateTime } from '@/domain/models/api/combinators/formats'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { cursorPaginationQuerySchema, cursorPaginationResponseSchema } from '../../combinators'
import { withDefault } from '../../combinators/schema-defaults'
import { adminEnvelopeSchema } from '../envelope/admin-envelope'

/**
 * Where a link's definition comes from.
 *
 * Load-bearing rather than informational: it is what the console gates its Edit
 * and Delete affordances on. A `config` link is declared in a file the console
 * may not write, so its mutation endpoints answer 409 — and painting a control
 * the backend will refuse is a defect, not a cosmetic issue ([internal ref] D2).
 */
export const linkSourceSchema = Schema.Literals(['config', 'db']).annotate({
  description:
    "Where this link is declared: 'config' for an app.links[] entry (read-only from the console) or 'db' for one minted at runtime.",
})

/**
 * The operational state a link is currently in.
 *
 * Derived, never stored — computed by the SAME resolution function the redirect
 * handler uses, so the console can never report a state the resolver disagrees
 * with. That single-decision-function rule is why `automations` reports pause
 * state correctly, and it is copied here deliberately.
 */
export const linkStateSchema = Schema.Literals([
  'active',
  'disabled',
  'scheduled',
  'expired',
  'exhausted',
  'archived',
]).annotate({
  description:
    "Current operational state, derived by the resolver: 'scheduled' before validFrom, 'expired' after validUntil, 'exhausted' past maxClicks, 'disabled' by config or the console overlay, 'archived' when soft-deleted.",
})

/**
 * A link as the catalog presents it.
 *
 * NOTE what is absent: no `password`, and no hash of one. [internal ref] D5 makes that a
 * condition of the console's authorisation rather than an implementation detail —
 * the payload is the boundary the operator's browser, proxy and error tracker all
 * see, so masking in the UI would not be redaction.
 */
export const adminLinkSchema = Schema.Struct({
  slug: Schema.String.annotate({
    description: 'The path segment after /l/. Lowercase and dot-free by construction.',
  }).pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(64))),
  shortUrl: Schema.String.annotate({
    description:
      'The link’s own address, precomputed (e.g. "/l/spring-promo"). Precomputed because the catalog grid renders it as a cell and has no template formatter.',
  }),
  destination: Schema.String.annotate({
    description:
      'Where the link currently sends a visitor. For a link with several targets this is the first one; the full list is on the detail endpoint.',
  }),
  title: Schema.NullOr(
    Schema.String.annotate({ description: 'Operator-facing name, or null when none is declared.' })
  ),
  tags: Schema.Array(Schema.String).annotate({
    description: 'Filing tags, used by the console’s tag filter.',
  }),
  source: linkSourceSchema,
  state: linkStateSchema,
  validFrom: Schema.NullOr(
    looseIsoDateTime({
      description: 'ISO 8601 start of the activation window, or null when unbounded.',
    })
  ),
  validUntil: Schema.NullOr(
    looseIsoDateTime({
      description: 'ISO 8601 end of the activation window, or null when unbounded.',
    })
  ),
  maxClicks: Schema.NullOr(
    Schema.Int.annotate({
      description:
        'Click cap, or null when uncapped. Counted over the analytics event store within its retention window, so it is retention-bounded and best-effort under burst (DEC-084 D6).',
    }).pipe(Schema.check(Schema.isGreaterThan(0)))
  ),
  _admin: adminEnvelopeSchema.annotate({ description: 'Canonical admin envelope.' }),
}).annotate({ identifier: 'AdminLink' })

/**
 * Query schema for `GET /api/admin/links`.
 *
 * `q` narrows SERVER-SIDE and the response echoes it back as `appliedQuery`, so
 * the grid knows not to re-filter the page it was handed. Without that echo a
 * client would filter an already-filtered page and silently hide matches that
 * live on the next one.
 */
export const adminLinksListQuerySchema = Schema.Struct({
  ...cursorPaginationQuerySchema.fields,
  q: optionalField(
    Schema.String.annotate({
      description: 'Free-text narrowing over slug, title and destination. Applied server-side.',
    })
  ),
  tag: optionalField(Schema.String.annotate({ description: 'Narrow to links carrying this tag.' })),
  source: optionalField(
    linkSourceSchema.annotate({ description: 'Narrow to config-declared or console-minted links.' })
  ),
  state: optionalField(
    linkStateSchema.annotate({ description: 'Narrow to one operational state.' })
  ),
  include_archived: coercedBoolean
    .annotate({
      description:
        'When true, soft-deleted links are included with `_admin.deletedAt` populated. Default false.',
    })
    .pipe(withDefault(false)),
})

/**
 * Response schema for `GET /api/admin/links`.
 *
 * `items` sits at the TOP LEVEL deliberately. The generic data-table island reads
 * `json[rowsKey]` as a plain key rather than a dotted path, so a nested envelope
 * would not bind — the same constraint that has kept every admin overview
 * endpoint's nested `series` block unchartable.
 */
export const adminLinksListResponseSchema = Schema.Struct({
  ...cursorPaginationResponseSchema(adminLinkSchema).fields,
  total: Schema.Int.annotate({
    description: 'Total links matching the filters, across all pages.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  appliedQuery: Schema.NullOr(
    Schema.String.annotate({
      description:
        'The `q` the server actually applied, echoed so the grid does not re-filter in memory. Null when no narrowing was requested.',
    })
  ),
}).annotate({ identifier: 'AdminLinksListResponse' })

/**
 * TypeScript type for one catalog row
 * @public
 */
export type AdminLink = typeof adminLinkSchema.Type

/**
 * TypeScript type for the catalog response
 * @public
 */
export type AdminLinksListResponse = typeof adminLinksListResponseSchema.Type

/**
 * TypeScript type for the catalog query
 * @public
 */
export type AdminLinksListQuery = typeof adminLinksListQuerySchema.Type
