/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `GET /oauth/consent` — the human-facing half of the authorization-code flow.
 *
 * Better Auth's OAuth provider is configured with `consentPage: '/oauth/consent'`
 * (`plugins/oauth-server.ts`) and duly redirects the browser there whenever a
 * non-trusted client needs consent. Until this route existed, that redirect
 * landed on a 404: every OAuth spec in the suite was green only because
 * `[internal ref]` steps over the page and POSTs
 * `/api/auth/oauth2/consent` directly — an API call no browser makes. The token
 * machinery was proven; the screen a real MCP client reaches was not.
 *
 * ─── A PLATFORM ROUTE, IN THE SHORT-LINK SLOT ───────────────────────────────
 *
 * Structurally `/s/design-system/:token` and `/l/:slug`: registered AFTER the
 * static assets, so a real shipped file still wins, and BEFORE
 * `setupPageRoutes`, whose `/:lang/*` route would otherwise match
 * `/oauth/consent` and render a terminal 404 instead of calling `next()`.
 *
 * Unlike those two it is gated on `app.auth`. The OAuth provider is only
 * mounted when auth is configured (`buildOauthServerPlugin` returns `[]`
 * otherwise), so on an app with no auth there is no flow that can reach this
 * page and no client table to read — the route must not exist rather than
 * answer for a provider that isn't there.
 *
 * ─── ONE ANSWER FOR EVERY REFUSAL ───────────────────────────────────────────
 *
 * Missing `client_id`, unknown `client_id`, disabled client, database failure:
 * all `c.notFound()`. A consent screen that renders for a client_id that was
 * never registered is a phishing page with extra steps — an attacker who can
 * choose the query string could otherwise put an arbitrary "authorize access"
 * screen on the operator's own domain. And distinguishing "unknown" from
 * "disabled" would make the page an oracle for which client_ids exist
 * (standing rule S1).
 *
 * ─── ONE VERB ───────────────────────────────────────────────────────────────
 *
 * Only `.get` is registered. The accept/deny decision is a POST to Better
 * Auth's own `/api/auth/oauth2/consent`, which owns the signed-query check and
 * the code issue; this route renders and nothing else.
 */

import { Effect } from 'effect'
import { OAuthServerRepository } from '@/application/ports/repositories/auth/oauth-server-repository'
import { logError } from '@/infrastructure/logging/logger'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { renderOAuthConsentDocument } from '../../render/page/oauth-consent-document'
import type { OAuthConsentColors } from '../../render/page/oauth-consent-document'
import type { OAuthClientRecord } from '@/application/ports/repositories/auth/oauth-server-repository'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

/** The palette the consent screen borrows from the app's own theme. */
const consentColors = (app: App): OAuthConsentColors => {
  const colors = app.design?.colors
  return {
    background: colors?.background,
    foreground: colors?.foreground,
    primary: colors?.primary,
  }
}

/**
 * Normalize a `redirect_uris` column value into a list of strings.
 *
 * The column is `text[]` under Postgres and a JSON-encoded array under SQLite,
 * so Drizzle hands back a real array on both dialects — but the SQLite `json`
 * mode types as `unknown`, and a hand-written row could hold anything. Filter
 * rather than trust: a non-string entry is dropped, and a column that is not an
 * array at all yields an empty list, which the caller treats as a miss.
 */
/**
 * Whether a third party attested this client's metadata.
 *
 * Registration is self-service, so `client_name` is worth exactly nothing on
 * its own. Two things are worth something: an RFC 7591 `software_statement`
 * (a JWT signed by a trusted issuer asserting the client's metadata) and a
 * Client ID Metadata Document (`client_discovery_id` — upstream's
 * domain-verified answer for the MCP case, via `@better-auth/cimd`). Absent
 * both, the screen says so.
 */
const isAttested = (client: Readonly<OAuthClientRecord>): boolean =>
  (client.softwareStatement !== undefined && client.softwareStatement.length > 0) ||
  (client.clientDiscoveryId !== undefined && client.clientDiscoveryId.length > 0)

/**
 * Setup the OAuth consent screen.
 *
 * @param honoApp - Hono application instance.
 * @param app - Decoded app configuration.
 * @returns The Hono app with the consent screen chained (unchanged without auth).
 */
export function setupOauthConsentRoutes(honoApp: Readonly<Hono>, app: App): Readonly<Hono> {
  if (!app.auth) return honoApp

  return honoApp.get('/oauth/consent', async (c) => {
    const clientId = c.req.query('client_id')
    if (clientId === undefined || clientId.length === 0) return c.notFound()

    // A database failure answers exactly like a miss. A 500 that a valid
    // client_id does not produce would turn this page into an oracle for
    // whether a guessed client_id exists — which is why the failure is mapped
    // to `undefined` here rather than allowed to reach the error handler.
    const lookup = Effect.gen(function* () {
      const repository = yield* OAuthServerRepository
      return yield* repository.findClientByClientId(clientId)
    }).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() => logError('[oauth-consent] client lookup failed', cause))
      ),
      // effect-swallow: see the comment above — the 404 IS the security
      // property here, so the failure may not reach the error handler. The
      // cause is logged on the way past (E6).
      Effect.orElseSucceed((): OAuthClientRecord | undefined => undefined)
    )
    const client = await runDomainPromise(c, lookup)

    if (!client || client.disabled) return c.notFound()

    const { redirectUris } = client
    // A client with no usable registered redirect URI has no address to show,
    // and the address is the whole security property of this screen. Refuse
    // rather than render an identity-free consent prompt.
    if (redirectUris.length === 0) return c.notFound()

    const scopes = (c.req.query('scope') ?? '').split(' ').filter((scope) => scope.length > 0)

    return c.html(
      renderOAuthConsentDocument(
        {
          name: client.name,
          redirectUris,
          verified: isAttested(client),
        },
        {
          scopes,
          // Forwarded verbatim: Better Auth signs this query and re-reads it at
          // `POST /oauth2/consent`, so rebuilding it would invalidate the
          // signature.
          oauthQuery: new URL(c.req.url).search.replace(/^\?/, ''),
        },
        app.name,
        consentColors(app)
      ),
      200,
      {
        // Never cached anywhere: the page is bound to one in-flight
        // authorization request and its signed query expires.
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      }
    )
  })
}
