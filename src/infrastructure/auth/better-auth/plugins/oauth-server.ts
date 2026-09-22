/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mcp } from '@better-auth/mcp'
import { jwt } from 'better-auth/plugins'
import { isAnonymousClientRegistrationEnabled } from '@/domain/models/process-env/oauth'
import { mcpResourceIdentifier } from '../mcp-resource-identity'
import type { Auth } from '@/domain/models/app/auth'

/**
 * Build the Better Auth `oauth-provider` plugin (canonical OAuth 2.1 / OIDC 1.0
 * authorization server).
 *
 * The plugin exposes the standard set of endpoints under `/api/auth/oauth2/*`:
 *
 * - `GET /.well-known/oauth-authorization-server` — RFC 8414 metadata
 * - `GET /.well-known/openid-configuration`        — OIDC Discovery 1.0
 * - `POST /api/auth/oauth2/register`               — RFC 7591 Dynamic Client Registration
 * - `GET  /api/auth/oauth2/authorize`              — OAuth 2.1 authorization (PKCE-S256 required)
 * - `POST /api/auth/oauth2/consent`                — User-consent acknowledgement
 * - `POST /api/auth/oauth2/continue`               — Resume after select-account / postLogin
 * - `POST /api/auth/oauth2/token`                  — Token endpoint (authorization_code + refresh_token)
 * - `GET  /api/auth/oauth2/userinfo`               — OIDC UserInfo (claims for the access token)
 * - `POST /api/auth/oauth2/introspect`             — RFC 7662 introspection
 * - `POST /api/auth/oauth2/revoke`                 — RFC 7009 revocation
 * - `POST /api/auth/oauth2/get-client`             — Plugin-specific client lookup helper
 *
 * Sovrium-tuned defaults:
 *
 * - `allowDynamicClientRegistration: true` — required so MCP clients (Claude
 *   Desktop, ChatGPT Dev Mode) can self-register without operator action.
 * - `accessTokenExpiresIn: 3600` (1h)      — industry standard.
 * - `refreshTokenExpiresIn: 30 * 24 * 3600` (30d) — industry standard.
 * - `loginPage: '/login'`                  — Sovrium engine page.
 * - `consentPage: '/oauth/consent'`        — Sovrium engine page.
 *
 * The plugin is only mounted when `app.auth` is configured. Without auth, all
 * `/api/auth/*` routes return 404 and there is no identity to authorize.
 *
 * Note: Sovrium does NOT expose plugin options in the app schema yet. All
 * tunables stay env-var driven (operator concern, split rule):
 * token lifetimes via Sovrium env vars when implementation lands; the schema
 * may grow `app.auth.oauthServer.{...}` fields in a future pass once the
 * route wiring is complete and we know which knobs schema authors actually
 * need vs which stay operator-only.
 */
export const buildOauthServerPlugin = (authConfig?: Auth) => {
  if (!authConfig) return []

  return [
    // The JWT plugin is a peer dependency of oauth-provider when
    // `disableJwtPlugin` is false (the default + recommended path). It signs
    // OIDC `id_token`s and OAuth access tokens with rotating EdDSA keys
    // exposed through the `/.well-known/jwks.json` endpoint. Without this
    // plugin oauth-provider throws `BetterAuthError("jwt_config")` at first
    // use (see `node_modules/@better-auth/oauth-provider/dist/utils-*.mjs`).
    jwt(),
    mcp({
      // ────────────────────────────────────────────────────────────────────
      // MCP protected resource (RFC 8707 / RFC 9728)
      //
      // `mcp()` IS the OAuth provider — it cannot be composed with a separate
      // `oauthProvider()`. Naming a resource lets a client ask for a token
      // audience-bound to THIS MCP server, which is what the endpoint checks
      // before it accepts a bearer.
      //
      // A consequence worth stating plainly: an audience-bound token is issued
      // as a signed JWT rather than as an opaque database row, and a JWT cannot
      // be revoked per-token — `/oauth2/revoke` answers `unsupported_token_type`
      // for one. It reaches only clients that ASK for the resource; a client
      // that never sends a `resource` parameter still receives an opaque,
      // revocable token, so existing OAuth clients are unaffected.
      //
      // What replaces per-token revocation is session liveness: introspection
      // re-reads the token's `sid` against the live session row, so signing out
      // withdraws the token immediately. Specs -017 and -018 pin both halves.
      //
      // `accessTokenTtl` is deliberately short. A user's token has a `sid` to
      // check; a `client_credentials` token has none, and expiry is the only
      // control left over it.
      // ────────────────────────────────────────────────────────────────────
      resource: mcpResourceIdentifier(),
      resources: [
        {
          identifier: mcpResourceIdentifier(),
          name: 'Sovrium MCP server',
          accessTokenTtl: 900, // 15 minutes
        },
      ],
      // ──────────────────────────────────────────────────────────────────────
      // Dynamic Client Registration (RFC 7591)
      //
      // MCP clients self-register before driving an authorization-code flow.
      // The plugin guards /register with TWO separate checks: one for dynamic
      // registration, one for session presence. `allowDynamicClientRegistration`
      // stays `true` so a signed-in user can self-register a client.
      //
      // `allowUnauthenticatedClientRegistration` is the second check, and it is
      // now OFF by default. It was hardcoded `true`, which made
      // /register an unauthenticated WRITE: any caller could mint a `client_id`
      // carrying an attacker-chosen `client_name` and `redirect_uris`, and the
      // name is what the consent screen shows the user — a phishing primitive on
      // top of an unbounded insert into `auth.oauth_client`. Better Auth's own
      // default is `false`, and upstream's answer for the very MCP case this was
      // enabled for is the `@better-auth/cimd` plugin (domain-verified Client ID
      // Metadata Documents), not open registration.
      //
      // With it off the endpoint answers 401 + `WWW-Authenticate: Bearer`, NOT
      // 404: `registration_endpoint` is advertised in the RFC 8414 metadata
      // document, so its existence is public by design and there is nothing to
      // enumerate. The 404 anti-enumeration rule governs OBJECT access, not the
      // presence of a spec-mandated endpoint.
      //
      // Operators running Sovrium as a public MCP server re-open it with
      // `SOVRIUM_OAUTH_ANONYMOUS_CLIENT_REGISTRATION=true` — Claude Desktop,
      // Cursor and ChatGPT Dev Mode all register before any browser session
      // exists. Env var and not schema: operator posture, not app-author intent
      // (the [internal ref] split).
      //
      // Specs: [internal ref] (refused by default), -021 (the env var
      // re-opens it).
      // ──────────────────────────────────────────────────────────────────────
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: isAnonymousClientRegistrationEnabled(),

      // ──────────────────────────────────────────────────────────────────────
      // Token lifetimes (industry-standard defaults)
      //
      // These are operator concerns; surfacing them in schema would be noise
      // for app authors. If/when an operator needs to tune them, they will
      // be elevated to env vars ([internal ref] env-var-vs-schema split).
      // ──────────────────────────────────────────────────────────────────────
      accessTokenExpiresIn: 3600, // 1 hour
      refreshTokenExpiresIn: 30 * 24 * 3600, // 30 days

      // ──────────────────────────────────────────────────────────────────────
      // Engine page paths (required by the plugin)
      //
      // - `loginPage` is where the plugin redirects unauthenticated users
      //   when an OAuth flow needs them logged in (`prompt=login` or no
      //   active session).
      // - `consentPage` is where the plugin redirects to capture user
      //   consent for non-trusted clients. The page calls
      //   `POST /api/auth/oauth2/consent` to complete the flow.
      //
      // Both paths are Sovrium engine pages — they exist in the page tree
      // when `app.auth` is configured. Schema authors don't change them.
      // ──────────────────────────────────────────────────────────────────────
      loginPage: '/login',
      consentPage: '/oauth/consent',

      // No `silenceWarnings` here: the option no longer exists, and the
      // startup warning it used to suppress is gone with it. It fired because
      // Better Auth mounts under `/api/auth` rather than the root, so the
      // authorization-server metadata document lives at
      // `/api/auth/.well-known/oauth-authorization-server`. That was always a
      // false positive — `setupOauthProtectedResourceRoute` and the plugin's
      // own metadata endpoint serve the document at the correct path, which
      // the OAuth specs assert.
    }),
  ]
}
