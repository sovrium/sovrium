/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `GET /s/design-system/{token}` — the anonymous share reader.
 *
 * The sixth surface on [internal ref]'s list and the FIRST anonymous one in that ADR's
 * history (amendment A3 Part 2). A charter's audience is "team members,
 * collaborators, and external partners" — designers, agencies, client
 * stakeholders who will never have a login on this instance and should never be
 * given one. Today they get a 404 from exactly the artifact written for them.
 * The operator mints a revocable, unlisted link; the reader sees the design
 * system; nobody gets an account.
 *
 * ─── A PLATFORM ROUTE WITH A DATABASE LOOKUP ────────────────────────────────
 *
 * Structurally the `/l/{slug}` shape [internal ref] D1 authorised, and registered in
 * the same slot for the same reason: AFTER static assets, so a real shipped
 * file always wins, and BEFORE `setupPageRoutes`, whose `/:lang/*` route would
 * otherwise match `/s/...` and render a terminal 404 instead of calling
 * `next()`.
 *
 * It is simpler than its precedent. `/l/{slug}` resolves config-first and needs
 * a whole clause reserving config-declared slugs against shadowing; there is no
 * `design.shares[]` and there must not be one, so the share namespace is
 * database-only and there is nothing to shadow.
 *
 * Being a platform route also buys the UNLISTED property by construction: out
 * of `getPublicPagePaths`, out of page-cacheability, out of the sitemap (which
 * walks `pages[]` only), and out of the brand-zone check, whose scope note says
 * API and platform routes are the platform's, not the app's.
 *
 * ─── ONE ANSWER FOR EVERY REFUSAL ───────────────────────────────────────────
 *
 * Unknown token, malformed token, revoked token: all `c.notFound()`, never 403,
 * and the body never confirms that a token ever existed. "This link has been
 * revoked" is a different answer from "no such link", and the difference is
 * exactly what an enumerator harvests (standing rule S1). The repository
 * enforces this structurally — its lookup filters `revoked_at IS NULL`, so a
 * revoked row is not reachable here to be reported on.
 *
 * The 404 body also never echoes the requested token, which would put it in
 * every proxy log between the reader and the server.
 *
 * ─── ONE VERB ───────────────────────────────────────────────────────────────
 *
 * Only `.get` is registered, so every mutating verb falls through to the
 * platform 404. A3: the share reader is a READER — no comment, no annotation,
 * no feedback control, no upload, no reader-supplied content of any kind. It is
 * the surface with the widest audience and the weakest authentication, so it is
 * the last place a write should be reachable.
 */

import { Effect } from 'effect'
import { buildDesignSystem } from '@/application/use-cases/admin/design-system'
import { renderDesignSystemMarkdown } from '@/application/use-cases/admin/design-system-markdown'
import { resolveDesignSystemShare } from '@/application/use-cases/admin/design-system-share'
import { designSystemDocumentSchema } from '@/domain/models/api/admin/design-system'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { provideDomain } from '@/infrastructure/logging/request-effect'
import { renderDesignSystemShareDocument } from '../../render/page/design-system-share-document'
import type { DesignSystemShareRepository } from '@/application/ports/repositories/design-system/design-system-share-repository'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * Run a share program to a `Result`, never throwing into the Hono handler.
 *
 * Reads `DesignSystemShareRepository` off the request's domain services rather
 * than building a layer here (W5b, standing rule E1). The layer it used to
 * build — `Layer.provide(DesignSystemShareRepositoryLive, DatabaseLive)` — was
 * constructed on EVERY request; the port is now in the app layer, so it is
 * resolved once at boot and this function only discharges the requirement.
 */
const runReader = <A, E>(c: Context, program: Effect.Effect<A, E, DesignSystemShareRepository>) =>
  Effect.runPromise(Effect.result(provideDomain(c, program)))

/**
 * The palette the share document paints itself with.
 *
 * Read off the same `design.colors` the projection describes — the visual
 * tokens are the part of `design` already mirrored onto the public render path,
 * so nothing here widens the exposure the projection itself carries.
 */
const shareDocumentColors = (
  app: App
): {
  readonly background?: string | undefined
  readonly foreground?: string | undefined
  readonly primary?: string | undefined
} => {
  const colors = app.design?.colors
  return {
    background: colors?.background,
    foreground: colors?.foreground,
    primary: colors?.primary,
  }
}

/**
 * Setup the anonymous design-system share reader.
 *
 * Registered UNCONDITIONALLY, like `/l/:token`: shares are minted into
 * `system.design_system_shares` from the console on an app whose config
 * declares nothing about them, and an early return here would leave `/s/*`
 * unrouted for exactly that app — the operator would mint a link, get a 201,
 * and watch it 404.
 *
 * @param honoApp - Hono application instance.
 * @param app - Decoded app configuration.
 * @returns The Hono app with the share reader chained.
 */
export function setupDesignSystemShareRoutes(honoApp: Readonly<Hono>, app: App): Readonly<Hono> {
  return honoApp.get('/s/design-system/:token', async (c) => {
    const token = c.req.param('token')

    const resolved = await runReader(c, resolveDesignSystemShare(app.name, token))
    // A database failure is answered exactly like a miss. The alternative — a
    // 500 that a valid token does not produce — would turn the reader into an
    // oracle for whether a guessed token exists.
    if (resolved._tag === 'Failure' || resolved.success === undefined) return c.notFound()

    // The A2 projection, validated before serialising. The contract is
    // `.strict()` throughout precisely so a field smuggled into the payload is
    // refused here rather than published to a stranger.
    const parsed = decodeSafe(designSystemDocumentSchema)(buildDesignSystem(app))
    if (!parsed.success) return c.notFound()

    const markdown = renderDesignSystemMarkdown(parsed.data, app.name)
    return c.html(
      renderDesignSystemShareDocument(markdown, app.name, shareDocumentColors(app)),
      200,
      {
        // Never a shared cache: the document is reachable only with the token,
        // and a proxy holding it would keep serving a design system whose link
        // the operator has already revoked.
        'Cache-Control': 'no-store',
        // Unlisted means unlisted. The sitemap never sees this route, and this
        // header covers the crawler that reached it some other way.
        'X-Robots-Tag': 'noindex, nofollow',
      }
    )
  })
}
