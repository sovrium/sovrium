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

import { eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { authOauthClientsTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { renderOAuthConsentDocument } from './oauth-consent-document'
import type { OAuthConsentColors } from './oauth-consent-document'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

/** The palette the consent screen borrows from the app's own theme. */
const consentColors = (app: App): OAuthConsentColors => {
  const colors = app.design?.theme?.colors ?? app.theme?.colors
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
const toRedirectUris = (value: unknown): ReadonlyArray<string> =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []

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
const isAttested = (row: {
  readonly softwareStatement: string | null
  readonly clientDiscoveryId: string | null
}): boolean =>
  (row.softwareStatement !== null && row.softwareStatement.length > 0) ||
  (row.clientDiscoveryId !== null && row.clientDiscoveryId.length > 0)

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

    const oauthClients = authOauthClientsTable()
    // A database failure answers exactly like a miss. A 500 that a valid
    // client_id does not produce would turn this page into an oracle for
    // whether a guessed client_id exists.
    const rows = await db
      .select()
      .from(oauthClients)
      .where(eq(oauthClients.clientId, clientId))
      .limit(1)
      .catch(() => [])

    const row = rows[0]
    if (!row || row.disabled === true) return c.notFound()

    const redirectUris = toRedirectUris(row.redirectUris)
    // A client with no usable registered redirect URI has no address to show,
    // and the address is the whole security property of this screen. Refuse
    // rather than render an identity-free consent prompt.
    if (redirectUris.length === 0) return c.notFound()

    const scopes = (c.req.query('scope') ?? '').split(' ').filter((scope) => scope.length > 0)

    return c.html(
      renderOAuthConsentDocument(
        {
          name: row.name ?? undefined,
          redirectUris,
          verified: isAttested(row),
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
