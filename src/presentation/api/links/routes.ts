/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Mount the `app.links` table at `/l/{slug}`.
 *
 * MOUNT ORDER is load-bearing in both directions, as it is for redirects:
 *
 * - AFTER the public-directory route, so a real shipped file always wins and a
 *   link can never hijack a path the app already serves.
 * - BEFORE the page routes. This one is MANDATORY rather than stylistic:
 *   `setupLanguageRoutes` registers `/:lang/*`, which matches `/l/abc`, and its
 *   handler renders a 404 terminally rather than calling `next()`. Mounted after
 *   pages, every short link would 404.
 *
 * ONE HANDLER for both `/l/{slug}` and `/l/{slug}.svg`, not two param routes.
 * The slug charset forbids `.`, so `token.endsWith('.svg')` is an EXACT
 * discriminator — there is no slug for which the suffix split is wrong — and one
 * handler cannot disagree with itself about which link it resolved.
 *
 * ─── WHAT THE THREE SIBLINGS HOLD ──────────────────────────────────────────
 *
 * W5c split this file at 492 lines against a 400 ceiling, along the seams its
 * own function boundaries already had. `link-gate.ts` answers which definition
 * a slug names and whether the visitor may pass; `link-click-analytics.ts`
 * reads the visitor off the request and records the click; `link-responses.ts`
 * owns the addressing and every response that is not a redirect. What is left
 * here is the ORDER those questions are asked in, which is the part that has to
 * be read top to bottom.
 */

import { requestSearch } from '@/domain/kernel/url/request-search'
import { renderLinkGatePage } from '@/domain/models/app/links/link-gate-page'
import { QR_MARKER_PARAM, resolveLinkOutcome } from '@/domain/models/app/links/link-resolver'
import { creditedClicks, recordClick, visitorContext } from './link-click-analytics'
import {
  gatePassword,
  resolveDeclaredOrStored,
  submittedPassword,
  verifyPassword,
} from './link-gate'
import { GONE, canonicalPath, respondGone, respondWithQr, splitSvgVariant } from './link-responses'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * Setup the `app.links` routing.
 *
 * @param honoApp - Hono application instance.
 * @param app - Decoded app configuration.
 * @returns The Hono app with the link routes chained.
 */
export function setupLinkRoutes(honoApp: Readonly<Hono>, app: App): Readonly<Hono> {
  // Registered UNCONDITIONALLY, even when `app.links` is empty. Links can be
  // minted from the console into `system.links` on an app whose config declares
  // none, and an early return here would leave `/l/*` unrouted for exactly that
  // app — the operator would create a link, get a 201, and watch it 404.
  const bySlug = new Map((app.links ?? []).map((link) => [link.slug, link]))

  /**
   * One handler for GET and POST alike.
   *
   * The POST exists only so a gate form has somewhere to submit to, and it must
   * resolve the link by exactly the same rules the GET does — a second lookup
   * path is how a gated link ends up honouring a lifecycle window on one verb
   * and not the other.
   */
  const handle = async (c: Context): Promise<Response> => {
    const { slug: token, isSvg } = splitSvgVariant(c.req.param('token') ?? '')

    // ONE canonical address per link. The slug is the analytics join key, so two
    // spellings would split one campaign across two rows — and the address gets
    // printed, where a reader's capitalisation is not under anyone's control.
    if (token !== token.toLowerCase()) return c.redirect(canonicalPath(token, isSvg), 301)

    const resolved = await resolveDeclaredOrStored(app, bySlug.get(token), token)
    if (resolved === undefined) return c.notFound()
    const { link, overlayDisabled } = resolved

    // The console's overlay may only ever be MORE restrictive than the file
    // ([internal ref] D3), so it is applied as a floor over whatever the definition
    // says rather than merged into it — an operator killing a link during an
    // incident must not be able to bring back one the config has switched off.
    if (overlayDisabled) return isSvg ? respondWithQr(c, GONE, token) : respondGone(c, GONE)

    const supplied = await submittedPassword(c)
    const outcome = resolveLinkOutcome(link, {
      now: new Date(),
      clickCount: await creditedClicks(c, app.name, link, token),
      requestSearch: requestSearch(c),
      draw: Math.random(),
      visitor: visitorContext(c),
      passwordSatisfied: verifyPassword(gatePassword(app, link), supplied),
    })

    // A QR code encodes the link's ADDRESS, not its destination, so a gate is
    // irrelevant to it — the visitor meets the gate when they follow the code.
    if (isSvg) return respondWithQr(c, outcome, token)
    if (outcome.kind === 'gone') return respondGone(c, outcome)
    if (outcome.kind === 'gated') {
      // `no-store` for the same reason the redirect carries it, and one more:
      // a cached interstitial would keep prompting after the gate was removed.
      c.header('Cache-Control', 'no-store')
      return c.html(renderLinkGatePage(token, supplied !== undefined), 200)
    }

    recordClick(c, app, {
      slug: token,
      destination: outcome.location,
      targetIndex: outcome.targetIndex,
      isScan: new URLSearchParams(requestSearch(c)).get(QR_MARKER_PARAM) !== null,
    })

    // `no-store` is the header that makes the whole feature honest: a cached
    // redirect would keep sending visitors to a destination after it was
    // re-pointed, and would silently defeat both `maxClicks` and `validUntil`
    // because the browser would never ask again.
    c.header('Cache-Control', 'no-store')
    return c.redirect(outcome.location, 302)
  }

  return honoApp.get('/l/:token', handle).post('/l/:token', handle)
}
