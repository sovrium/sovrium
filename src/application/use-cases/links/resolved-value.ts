/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The shape rules a slug and a destination must satisfy to be WRITTEN,
 * checked against the concrete value rather than against whatever the caller
 * decoded.
 *
 * ── Why this cannot live at a caller's boundary ────────────────────────────
 *
 * Every other caller validates what it PARSES. The automation `link` action
 * cannot: its props are templates, and a template is precisely a string that
 * fails these patterns on purpose. `product-{{trigger.record.handle}}` is
 * rejected by `LINK_SLUG_PATTERN` on the braces alone, and the archetypal
 * automation destination — `{{trigger.record.website}}`, a URL the record
 * already holds — matches neither branch of `LINK_DESTINATION_PATTERN`. So
 * decode-time validation on that path is necessarily shallow, and the real
 * check has nowhere to go but here, after interpolation and before the write.
 *
 * Putting it in the shared write path rather than in the handler is the whole
 * reason it is reliable. A guard a caller has to remember to call is a guard
 * the next caller forgets, and the direction it gets forgotten in is the one
 * that matters: a workflow minting `MyLink`, which the resolver lowercases to
 * a different address than the one the workflow just emailed out, or a
 * `javascript:` destination the config schema has refused since the day links
 * shipped. A second door into the same table has to be the same door.
 *
 * ── It closes a hole on the console path too ───────────────────────────────
 *
 * `POST /api/admin/links` validates `slug` against the pattern in its own Zod
 * schema but validates `destination` as nothing more than a non-empty string
 * (`createLinkRequestSchema`, `domain/models/api/admin/links/mutations.ts`),
 * so an operator-supplied `javascript:` destination reached storage. The
 * config schema has always refused one. Two write paths disagreeing about what
 * a link may point at is the defect class this module exists to retire, so the
 * rule is stated once, here, where both of them pass through.
 */

import { Effect } from 'effect'
import { LINK_DESTINATION_PATTERN } from '@/domain/models/app/links/destination'
import { LINK_SLUG_PATTERN } from '@/domain/models/app/links/slug'
import { LinkValueRejectedError } from './errors'

/** The stored column's own bound. A longer slug could not be persisted. */
const MAX_SLUG_LENGTH = 64

/**
 * Refuse a slug that is not a legal address.
 *
 * Checked on every operator, not just create. An update or delete naming an
 * illegal slug could only ever miss, and "that is not a slug" is a far more
 * actionable answer than the not-found it would otherwise earn.
 */
export const ensureSlugWellFormed = (slug: string): Effect.Effect<void, LinkValueRejectedError> => {
  if (slug.length > MAX_SLUG_LENGTH) {
    return Effect.fail(
      new LinkValueRejectedError({
        field: 'slug',
        slug,
        reason: `link slug '${slug}' is ${slug.length} characters — the maximum is ${MAX_SLUG_LENGTH}`,
      })
    )
  }
  return LINK_SLUG_PATTERN.test(slug)
    ? Effect.void
    : Effect.fail(
        new LinkValueRejectedError({
          field: 'slug',
          slug,
          reason: `link slug '${slug}' must be lowercase alphanumeric with single '-' or '_' separators — it must not contain '/', '.', uppercase letters or whitespace`,
        })
      )
}

/**
 * Refuse a destination that is not a root-relative path or an absolute
 * http(s) URL.
 *
 * `undefined` passes: an update that does not mention the destination is not
 * changing it, and a create without one is already refused upstream by the
 * exactly-one-of rule between `destination` and `targets`.
 */
export const ensureDestinationWellFormed = (
  slug: string,
  destination: string | undefined
): Effect.Effect<void, LinkValueRejectedError> => {
  if (destination === undefined) return Effect.void
  return LINK_DESTINATION_PATTERN.test(destination)
    ? Effect.void
    : Effect.fail(
        new LinkValueRejectedError({
          field: 'destination',
          slug,
          reason: `link destination '${destination}' must be a root-relative path (e.g. '/pricing') or an absolute http(s) URL — a scheme like 'javascript:' or 'data:' is refused, and a protocol-relative '//host' silently leaves the origin`,
        })
      )
}
