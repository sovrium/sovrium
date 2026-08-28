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

import { z } from '@hono/zod-openapi'

/**
 * The slug a mutation targets.
 *
 * Deliberately re-stated here rather than imported from the config schema: this
 * is an API boundary validating untrusted input, and the config schema is an
 * Effect Schema on the other side of the layer line. The two must agree, and the
 * E2E specs assert they do.
 */
const mutationSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/)
  .describe(
    "The path segment after /l/. Lowercase alphanumeric with single '-' or '_' separators. Dot-free, so the .svg QR suffix stays an exact discriminator."
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
  validFrom: z.iso
    .datetime()
    .nullable()
    .optional()
    .describe('ISO 8601 activation start. null clears it; omit to leave unchanged.'),
  validUntil: z.iso
    .datetime()
    .nullable()
    .optional()
    .describe('ISO 8601 activation end. null clears it; omit to leave unchanged.'),
  maxClicks: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .describe('Click cap. null clears it; omit to leave unchanged.'),
  expiredTo: z
    .string()
    .nullable()
    .optional()
    .describe('Where a dead link redirects instead of answering 410. null means answer 410.'),
}

const organisationFields = {
  title: z.string().min(1).max(200).nullable().optional().describe('Operator-facing name.'),
  tags: z.array(z.string()).max(20).optional().describe('Filing tags.'),
  notes: z.string().max(2000).nullable().optional().describe('Operator notes. Never public.'),
}

const utmFields = {
  utmSource: z.string().nullable().optional().describe('Appended as utm_source.'),
  utmMedium: z.string().nullable().optional().describe('Appended as utm_medium.'),
  utmCampaign: z.string().nullable().optional().describe('Appended as utm_campaign.'),
  utmContent: z.string().nullable().optional().describe('Appended as utm_content.'),
  utmTerm: z.string().nullable().optional().describe('Appended as utm_term.'),
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
const mutationTargetSchema = z
  .object({
    to: z.string().min(1).describe('Destination URL or app-relative path.'),
    weight: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        'Relative share of traffic. Defaults to 1; a zero would silently leave the rotation.'
      ),
  })
  .openapi('LinkMutationTarget')

/**
 * Request schema for `POST /api/admin/links`.
 *
 * `slug` and `destination` are the only required fields — the minimum a link
 * needs to resolve. Everything else has a sensible absence.
 */
export const createLinkRequestSchema = z
  .object({
    slug: mutationSlugSchema,
    destination: z
      .string()
      .min(1)
      .optional()
      .describe('Single destination. Mutually exclusive with `targets` — exactly one is required.'),
    targets: z
      .array(mutationTargetSchema)
      .min(1)
      .optional()
      .describe(
        'Candidate destinations for a weighted rotation. Mutually exclusive with `destination`.'
      ),
    enabled: z.boolean().optional().describe('Whether the link resolves. Defaults to true.'),
    ...lifecycleFields,
    ...organisationFields,
    ...utmFields,
  })
  .refine((request) => (request.destination === undefined) !== (request.targets === undefined), {
    message:
      'Provide exactly one of `destination` or `targets` — `destination` is single-destination shorthand for a one-element target list, so declaring both is ambiguous and declaring neither leaves the link with nowhere to resolve.',
    path: ['destination'],
  })
  .openapi('CreateLinkRequest')

/**
 * Request schema for `PATCH /api/admin/links/:slug`.
 *
 * SPARSE by construction — every field optional, and the slug is not among them.
 * A slug rename would silently break every share of the old address and orphan
 * its click history, which is keyed on the slug. Retire and re-mint instead.
 */
export const updateLinkRequestSchema = z
  .object({
    destination: z
      .string()
      .min(1)
      .optional()
      .describe('New single destination. Replaces any existing target list.'),
    targets: z
      .array(mutationTargetSchema)
      .min(1)
      .optional()
      .describe('New candidate destinations. Replaces any existing single destination.'),
    enabled: z.boolean().optional().describe('Whether the link resolves.'),
    ...lifecycleFields,
    ...organisationFields,
    ...utmFields,
  })
  .openapi('UpdateLinkRequest')

/**
 * Response body for a refused mutation.
 *
 * `code` is a stable machine-readable discriminant so the console can tell the
 * two refusals apart without parsing prose: `LINK_IS_CONFIG_DECLARED` means "edit
 * the file", `LINK_SLUG_TAKEN` means "pick another name".
 */
export const linkMutationConflictSchema = z
  .object({
    success: z.literal(false),
    code: z
      .enum(['LINK_IS_CONFIG_DECLARED', 'LINK_SLUG_TAKEN', 'LINK_RESERVED_SLUG'])
      .describe('Stable discriminant for the refusal, so the console need not parse the message.'),
    message: z.string().describe('Human-readable explanation naming the offending slug.'),
  })
  .openapi('LinkMutationConflict')

/**
 * TypeScript type for a create request
 * @public
 */
export type CreateLinkRequest = z.infer<typeof createLinkRequestSchema>

/**
 * TypeScript type for an update request
 * @public
 */
export type UpdateLinkRequest = z.infer<typeof updateLinkRequestSchema>

/**
 * TypeScript type for a refused mutation
 * @public
 */
export type LinkMutationConflict = z.infer<typeof linkMutationConflictSchema>
