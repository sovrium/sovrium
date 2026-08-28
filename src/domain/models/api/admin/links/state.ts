/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `POST /api/admin/links/:slug/enable` and `.../disable`.
 *
 * The operational overlay: an on/off switch that works on ANY link, including a
 * config-declared one. It is the incident lever — a short link leaking into a
 * phishing campaign has to be killable in one click at 03:00, not in a redeploy —
 * and it copies the shape `system.automation_pauses` already established for
 * pausing a config-declared automation.
 *
 * **The polarity is asymmetric, and that asymmetry is the whole design.** The
 * overlay may only ever be MORE restrictive than the config file:
 *
 *   config enabled  + overlay disable  →  200, the link stops resolving
 *   config enabled  + overlay enable   →  200, idempotent no-op
 *   config DISABLED + overlay enable   →  409, refused
 *   config DISABLED + overlay disable  →  409, refused
 *
 * Allowing the console to re-enable a link the file turned off would be the
 * console overruling a reviewed artefact — config mutation wearing a data-shaped
 * disguise, which is exactly what [internal ref] D2 exists to prevent. Refusing it in
 * both directions when config already says "off" keeps the file authoritative
 * without making the kill switch conditional on where the link was declared.
 *
 * Source story: [internal ref]
 */

import { z } from '@hono/zod-openapi'

/**
 * Response for a successful enable or disable.
 *
 * Returns the RESULTING state rather than an acknowledgement, so the console can
 * repaint from the response instead of guessing what it should now be. Guessing
 * is how a UI ends up showing "Disabled" for a link the resolver still serves.
 */
export const linkStateChangeResponseSchema = z
  .object({
    slug: z.string().describe('The link whose state changed.'),
    state: z
      .enum(['active', 'disabled', 'scheduled', 'expired', 'exhausted', 'archived'])
      .describe(
        'The state AFTER the change, computed by the resolver — not an echo of what was requested. A link enabled while still outside its window reports `scheduled`, not `active`.'
      ),
    changed: z
      .boolean()
      .describe(
        'False when the call was a no-op because the link was already in that state. Lets the console skip a redundant toast without treating idempotency as failure.'
      ),
  })
  .openapi('LinkStateChangeResponse')

/**
 * TypeScript type for a state-change response
 * @public
 */
export type LinkStateChangeResponse = z.infer<typeof linkStateChangeResponseSchema>
