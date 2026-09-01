/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The refusal vocabulary shared by every caller that mutates a link.
 *
 * One tagged error rather than three, because all three refusals are the same
 * kind of answer — "that slug is not yours to write" — and every caller has to
 * branch on WHICH one anyway. The admin route renders `code` into its 409
 * envelope; an automation step renders it into a step failure. Neither
 * re-derives the rule.
 */

import { Data } from 'effect'

/**
 * Why a slug refused a write.
 *
 * `LINK_RESERVED_SLUG` — the admin API serves `/api/admin/links/{overview,series}`,
 * so a link minted there would resolve publicly and be permanently invisible.
 * `LINK_IS_CONFIG_DECLARED` — `app.links` claims it; edit the file ([internal ref] D2).
 * `LINK_SLUG_TAKEN` — a live row already holds it.
 *
 * These are the exact three members of the wire enum in
 * `domain/models/api/admin/links/mutations.ts`; the admin route's Zod parse of
 * the 409 body is what keeps the two in step.
 */
export type LinkMutationConflictCode =
  'LINK_IS_CONFIG_DECLARED' | 'LINK_SLUG_TAKEN' | 'LINK_RESERVED_SLUG'

/**
 * A slug that cannot be written, and the reason.
 *
 * Carries the slug because a caller posting several mutations cannot act on a
 * refusal that does not name the one it means.
 */
export class LinkMutationConflictError extends Data.TaggedError('LinkMutationConflictError')<{
  readonly code: LinkMutationConflictCode
  readonly slug: string
}> {}

/**
 * A value that is not shaped like a link, refused before it reaches storage.
 *
 * Deliberately NOT a fourth `LinkMutationConflictCode`: that enum is mirrored
 * verbatim on the wire in `domain/models/api/admin/links/mutations.ts`, and the
 * admin route's Zod parse of the 409 body is what keeps the two in step —
 * adding a member here would silently widen a published contract. It is also a
 * different KIND of answer. A conflict says "that slug is not yours to write",
 * which is about ownership and earns a 409; this says "that is not a slug",
 * which is about the value and earns a 400.
 *
 * `field` names which of the two values was refused so a caller can point at
 * the offending prop rather than at the step.
 */
export class LinkValueRejectedError extends Data.TaggedError('LinkValueRejectedError')<{
  readonly field: 'slug' | 'destination'
  readonly slug: string
  /** Human-readable explanation, phrased for whoever wrote the value. */
  readonly reason: string
}> {}
