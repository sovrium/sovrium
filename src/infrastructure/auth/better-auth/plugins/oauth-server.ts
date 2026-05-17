/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { oauthProvider } from '@better-auth/oauth-provider'
import { jwt } from 'better-auth/plugins'
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
 * tunables stay env-var driven (operator concern, per DEC-022 split rule):
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
    oauthProvider({
      // ──────────────────────────────────────────────────────────────────────
      // Dynamic Client Registration (RFC 7591)
      //
      // MCP clients self-register before driving an authorization-code flow.
      // Required to be `true` so Claude Desktop / Cursor / ChatGPT Dev Mode
      // can connect without operator-managed client_id allowlists.
      //
      // `allowUnauthenticatedClientRegistration: true` is also required so
      // MCP clients can register without a prior user session. The oauth-
      // provider plugin guards the /register endpoint with two separate
      // checks: one for dynamic registration and one for session presence.
      // Without this flag the endpoint returns 401 even when dynamic
      // registration is enabled (see registerEndpoint() in the plugin source).
      // ──────────────────────────────────────────────────────────────────────
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,

      // ──────────────────────────────────────────────────────────────────────
      // Token lifetimes (industry-standard defaults)
      //
      // These are operator concerns; surfacing them in schema would be noise
      // for app authors. If/when an operator needs to tune them, they will
      // be elevated to env vars (DEC-022 env-var-vs-schema split).
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

      // ──────────────────────────────────────────────────────────────────────
      // Silence the "ensure '/.well-known/oauth-authorization-server/api/auth'
      // exists" startup warning. The plugin warns because Better Auth mounts
      // at `/api/auth` (not the root), so the AS metadata endpoint lives at
      // `/api/auth/.well-known/oauth-authorization-server` — not at
      // `/.well-known/oauth-authorization-server/api/auth`. Sovrium's
      // `setupOauthProtectedResourceRoute` and the plugin's own metadata
      // endpoint both serve the document at the correct path; the warning
      // is a false positive once route wiring is verified by the e2e specs.
      silenceWarnings: {
        oauthAuthServerConfig: true,
        openidConfig: true,
      },
    }),
  ]
}
