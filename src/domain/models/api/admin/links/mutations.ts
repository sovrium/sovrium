/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contracts for the link mutations: `POST /api/admin/links`,
 * `PATCH /api/admin/links/:slug` and `DELETE /api/admin/links/:slug`.
 *
 * These write to `system.links` — link DEFINITIONS created at runtime. They can
 * never touch `app.links[]`, and the boundary is enforced by status code rather
 * than by convention: a mutation naming a config-declared slug answers **409
 * Conflict**, not 404 and not a silent overwrite.
 *
 * That 409 is the clause the console's whole [internal ref] position rests on. A DB row
 * able to shadow a config link would be config mutation through a data-shaped
 * side door — the one path by which "a link is a record" would stop being true.
 * D2.
 *
 * **Why 409 and not 404**: the caller is an authenticated admin who can SEE the
 * row in the catalog. A 404 would be a lie, and would send them looking for a
 * missing link rather than at the config file they need to edit. The
 * anti-enumeration 404 (standing rule S1) applies to callers who should not know
 * the endpoint exists at all — a different question with a different answer.
 *
 * Source story: [internal ref]
 */

import { Schema } from 'effect'
import { looseIsoDateTime } from '@/domain/models/api/combinators/formats'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * The slug a mutation targets.
 *
 * Deliberately re-stated here rather than imported from the config schema: this
 * is an API boundary validating untrusted input, and the config schema is an
 * Effect Schema on the other side of the layer line. The two must agree, and the
 * E2E specs assert they do.
 */
const mutationSlugSchema = Schema.String.annotate({
  description:
    "The path segment after /l/. Lowercase alphanumeric with single '-' or '_' separators. Dot-free, so the .svg QR suffix stays an exact discriminator.",
}).pipe(
  Schema.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(64),
    Schema.isPattern(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/)
  )
)

/**
 * The lifecycle fields a mutation may set.
 *
 * `null` is meaningful and distinct from absence on a PATCH: absent means "leave
 * as it is", `null` means "clear it". Collapsing the two would make it
 * impossible to remove an expiry once set, which is exactly the edit an operator
 * makes when a campaign is extended.
 */
const lifecycleFields = {
  validFrom: optionalField(
    Schema.NullOr(
      looseIsoDateTime({
        description: 'ISO 8601 activation start. null clears it; omit to leave unchanged.',
      })
    )
  ),
  validUntil: optionalField(
    Schema.NullOr(
      looseIsoDateTime({
        description: 'ISO 8601 activation end. null clears it; omit to leave unchanged.',
      })
    )
  ),
  maxClicks: optionalField(
    Schema.NullOr(
      Schema.Int.annotate({
        description: 'Click cap. null clears it; omit to leave unchanged.',
      }).pipe(Schema.check(Schema.isGreaterThan(0)))
    )
  ),
  expiredTo: optionalField(
    Schema.NullOr(
      Schema.String.annotate({
        description: 'Where a dead link redirects instead of answering 410. null means answer 410.',
      })
    )
  ),
}

const organisationFields = {
  title: optionalField(
    Schema.NullOr(
      Schema.String.annotate({ description: 'Operator-facing name.' }).pipe(
        Schema.check(Schema.isMinLength(1), Schema.isMaxLength(200))
      )
    )
  ),
  tags: optionalField(
    Schema.Array(Schema.String)
      .annotate({ description: 'Filing tags.' })
      .pipe(Schema.check(Schema.isMaxLength(20)))
  ),
  notes: optionalField(
    Schema.NullOr(
      Schema.String.annotate({ description: 'Operator notes. Never public.' }).pipe(
        Schema.check(Schema.isMaxLength(2000))
      )
    )
  ),
}

const utmFields = {
  utmSource: optionalField(
    Schema.NullOr(Schema.String.annotate({ description: 'Appended as utm_source.' }))
  ),
  utmMedium: optionalField(
    Schema.NullOr(Schema.String.annotate({ description: 'Appended as utm_medium.' }))
  ),
  utmCampaign: optionalField(
    Schema.NullOr(Schema.String.annotate({ description: 'Appended as utm_campaign.' }))
  ),
  utmContent: optionalField(
    Schema.NullOr(Schema.String.annotate({ description: 'Appended as utm_content.' }))
  ),
  utmTerm: optionalField(
    Schema.NullOr(Schema.String.annotate({ description: 'Appended as utm_term.' }))
  ),
}

/**
 * One candidate destination on a mutation.
 *
 * Mirrors the config-side `targets[]` so a link minted from the console can be
 * the same shape as one declared in a file. Without this the read contracts
 * would expose a target list the write contracts could never produce — an
 * operator could see an A/B split but never create one, which makes variant
 * analytics unreachable for exactly the links they would experiment on.
 */
const mutationTargetSchema = Schema.Struct({
  to: Schema.String.annotate({ description: 'Destination URL or app-relative path.' }).pipe(
    Schema.check(Schema.isMinLength(1))
  ),
  weight: optionalField(
    Schema.Int.annotate({
      description:
        'Relative share of traffic. Defaults to 1; a zero would silently leave the rotation.',
    }).pipe(Schema.check(Schema.isGreaterThan(0)))
  ),
}).annotate({ identifier: 'LinkMutationTarget' })

/**
 * Request schema for `POST /api/admin/links`.
 *
 * `slug` and `destination` are the only required fields — the minimum a link
 * needs to resolve. Everything else has a sensible absence.
 */
export const createLinkRequestSchema = Schema.Struct({
  slug: mutationSlugSchema,
  destination: optionalField(
    Schema.String.annotate({
      description:
        'Single destination. Mutually exclusive with `targets` — exactly one is required.',
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  targets: optionalField(
    Schema.Array(mutationTargetSchema)
      .annotate({
        description:
          'Candidate destinations for a weighted rotation. Mutually exclusive with `destination`.',
      })
      .pipe(Schema.check(Schema.isMinLength(1)))
  ),
  enabled: optionalField(
    Schema.Boolean.annotate({ description: 'Whether the link resolves. Defaults to true.' })
  ),
  ...lifecycleFields,
  ...organisationFields,
  ...utmFields,
})
  .annotate({ identifier: 'CreateLinkRequest' })
  .pipe(
    Schema.check(
      Schema.makeFilter((value) =>
        ((request) => (request.destination === undefined) !== (request.targets === undefined))(
          value
        )
          ? undefined
          : 'Provide exactly one of `destination` or `targets` — `destination` is single-destination shorthand for a one-element target list, so declaring both is ambiguous and declaring neither leaves the link with nowhere to resolve.'
      )
    )
  )

/**
 * Request schema for `PATCH /api/admin/links/:slug`.
 *
 * SPARSE by construction — every field optional, and the slug is not among them.
 * A slug rename would silently break every share of the old address and orphan
 * its click history, which is keyed on the slug. Retire and re-mint instead.
 */
export const updateLinkRequestSchema = Schema.Struct({
  destination: optionalField(
    Schema.String.annotate({
      description: 'New single destination. Replaces any existing target list.',
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  targets: optionalField(
    Schema.Array(mutationTargetSchema)
      .annotate({
        description: 'New candidate destinations. Replaces any existing single destination.',
      })
      .pipe(Schema.check(Schema.isMinLength(1)))
  ),
  enabled: optionalField(Schema.Boolean.annotate({ description: 'Whether the link resolves.' })),
  ...lifecycleFields,
  ...organisationFields,
  ...utmFields,
}).annotate({ identifier: 'UpdateLinkRequest' })

/**
 * Response body for a refused mutation.
 *
 * `code` is a stable machine-readable discriminant so the console can tell the
 * two refusals apart without parsing prose: `LINK_IS_CONFIG_DECLARED` means "edit
 * the file", `LINK_SLUG_TAKEN` means "pick another name".
 */
export const linkMutationConflictSchema = Schema.Struct({
  success: Schema.Literal(false),
  code: Schema.Literals([
    'LINK_IS_CONFIG_DECLARED',
    'LINK_SLUG_TAKEN',
    'LINK_RESERVED_SLUG',
  ]).annotate({
    description: 'Stable discriminant for the refusal, so the console need not parse the message.',
  }),
  message: Schema.String.annotate({
    description: 'Human-readable explanation naming the offending slug.',
  }),
}).annotate({ identifier: 'LinkMutationConflict' })

/**
 * TypeScript type for a create request
 * @public
 */
export type CreateLinkRequest = typeof createLinkRequestSchema.Type

/**
 * TypeScript type for an update request
 * @public
 */
export type UpdateLinkRequest = typeof updateLinkRequestSchema.Type

/**
 * TypeScript type for a refused mutation
 * @public
 */
export type LinkMutationConflict = typeof linkMutationConflictSchema.Type
