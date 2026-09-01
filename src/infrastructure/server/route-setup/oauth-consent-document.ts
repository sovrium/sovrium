/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The OAuth consent screen document.
 *
 * ─── WHAT THIS SCREEN IS DEFENDING AGAINST ──────────────────────────────────
 *
 * A consent screen is the one moment in an authorization-code flow where a
 * human is asked to make a trust decision, and it is therefore the one place a
 * phishing client wants to reach. Client registration is self-service by
 * design — that is what Dynamic Client Registration is FOR — so every string a
 * client supplies about itself (`client_name`, `uri`, `icon`) is
 * attacker-choosable. A screen that renders `client_name` prominently and
 * nothing else hands an attacker a first-party-branded page on the operator's
 * own domain.
 *
 * Two properties make this screen safe rather than merely sequenced behind
 * credential-gated registration:
 *
 * 1. **The registered redirect origin is the primary identity on screen.** It
 *    is read from the client's stored row, never from the request, so it is
 *    exactly where the browser will be sent if the user accepts. A client
 *    cannot name itself something it is not, because the destination is not a
 *    name — it is the address.
 * 2. **Self-asserted metadata is labelled as such.** A client is `Verified`
 *    only when a third party attested its metadata: an RFC 7591
 *    `software_statement` (a signed assertion from a trusted issuer) or a
 *    Client ID Metadata Document (`client_discovery_id`, upstream's
 *    domain-verified answer for the MCP case). Anything self-registered reads
 *    `Unverified`, in the same visual weight as the name it qualifies.
 *
 * The self-asserted name is still shown — a user who initiated the flow needs
 * to recognise the app they clicked — but it is rendered as a quoted claim
 * subordinate to the origin, and it is HTML-escaped, since it reaches this
 * function straight from an unauthenticated-in-spirit registration payload.
 */

import { escapeHtml } from '@/domain/services/markdown/markdown-renderer'

/** What the screen needs to know about the client asking for authorization. */
export interface OAuthConsentClient {
  /** Self-asserted display name from registration. Attacker-choosable. */
  readonly name?: string | undefined
  /** Registered redirect URIs, read from the stored row — never the request. */
  readonly redirectUris: ReadonlyArray<string>
  /** True when a third party attested this client's metadata. */
  readonly verified: boolean
}

/** The scopes the client is asking for, plus the query to hand back. */
export interface OAuthConsentRequest {
  readonly scopes: ReadonlyArray<string>
  /**
   * The verbatim query string this page was landed with. Better Auth signs it
   * and re-reads it at `POST /oauth2/consent`, so the page must forward it
   * untouched rather than rebuild it.
   */
  readonly oauthQuery: string
}

/**
 * Reduce a redirect URI to the origin the browser will actually be sent to.
 *
 * The origin is the security-relevant part — `http://localhost:33418` is the
 * claim a user can evaluate, while the path is noise. A URI that will not
 * parse is shown verbatim rather than dropped: an unparseable destination is
 * information the user should have, and silently hiding it would leave the
 * screen naming nothing at all.
 */
const redirectOrigin = (uri: string): string => {
  try {
    return new URL(uri).host
  } catch {
    return uri
  }
}

/**
 * Human-readable descriptions for the standard OIDC scopes.
 *
 * An unknown scope is shown by its raw name rather than hidden — a scope the
 * screen cannot describe is precisely the one a user most needs to see.
 */
const SCOPE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  openid: 'Confirm who you are',
  profile: 'Read your name and profile details',
  email: 'Read your email address',
  offline_access: 'Stay connected when you are not using the app',
}

const scopeLine = (scope: string): string => {
  const description = SCOPE_DESCRIPTIONS[scope]
  const label = description === undefined ? scope : description
  return `<li><span class="scope-label">${escapeHtml(label)}</span><code>${escapeHtml(scope)}</code></li>`
}

const documentStyles = (colors: OAuthConsentColors): string => {
  const background = colors.background ?? '#f6f7f9'
  const foreground = colors.foreground ?? '#111827'
  const primary = colors.primary ?? '#2563eb'
  return `
:root{--bg:${background};--fg:${foreground};--primary:${primary};--muted:#6b7280;--line:#e5e7eb;--surface:#ffffff}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem;
background:var(--bg);color:var(--fg);
font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.5}
main{width:100%;max-width:30rem;background:var(--surface);border:1px solid var(--line);
border-radius:0.75rem;padding:1.75rem;box-shadow:0 1px 3px rgb(0 0 0 / 0.08)}
h1{margin:0 0 1.25rem;font-size:1.25rem;font-weight:600}
.origin{display:block;font-size:1.05rem;font-weight:600;word-break:break-all}
.identity{border:1px solid var(--line);border-radius:0.5rem;padding:0.875rem 1rem;margin-bottom:1.25rem}
.claimed{margin:0.35rem 0 0;font-size:0.875rem;color:var(--muted);word-break:break-word}
.badge{display:inline-block;margin-bottom:0.5rem;padding:0.125rem 0.5rem;border-radius:9999px;
font-size:0.75rem;font-weight:600;letter-spacing:0.02em;text-transform:uppercase}
.badge-unverified{background:#fef3c7;color:#92400e}
.badge-verified{background:#d1fae5;color:#065f46}
.warning{margin:0.6rem 0 0;font-size:0.8125rem;color:var(--muted)}
h2{margin:0 0 0.5rem;font-size:0.8125rem;font-weight:600;text-transform:uppercase;
letter-spacing:0.04em;color:var(--muted)}
ul{list-style:none;margin:0 0 1.5rem;padding:0}
li{display:flex;align-items:baseline;justify-content:space-between;gap:0.75rem;
padding:0.5rem 0;border-bottom:1px solid var(--line);font-size:0.9375rem}
li:last-child{border-bottom:0}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.75rem;color:var(--muted)}
.actions{display:flex;gap:0.75rem}
button{flex:1;padding:0.625rem 1rem;border-radius:0.5rem;font-size:0.9375rem;font-weight:600;
cursor:pointer;border:1px solid var(--line);background:var(--surface);color:var(--fg)}
button.primary{background:var(--primary);border-color:var(--primary);color:#fff}
button[disabled]{opacity:0.6;cursor:progress}
.error{margin:1rem 0 0;font-size:0.875rem;color:#b91c1c}
.error:empty{display:none}
`
}

/** The palette the consent screen paints itself with. */
export interface OAuthConsentColors {
  readonly background?: string | undefined
  readonly foreground?: string | undefined
  readonly primary?: string | undefined
}

/**
 * The identity block — the security-load-bearing part of the screen.
 *
 * Order is deliberate: the verification badge first, then the registered
 * origin at full weight, then the self-asserted name as a quoted claim. A
 * reader who stops after the first two lines has still seen everything that
 * cannot be forged.
 */
const renderIdentity = (client: OAuthConsentClient): string => {
  const origins = [...new Set(client.redirectUris.map(redirectOrigin))]
  const originMarkup = origins
    .map((origin) => `<span class="origin">${escapeHtml(origin)}</span>`)
    .join('')
  const claimedName =
    client.name === undefined || client.name.length === 0
      ? ''
      : `<p class="claimed">Calls itself “${escapeHtml(client.name)}”.</p>`
  const badge = client.verified
    ? '<span class="badge badge-verified">Verified</span>'
    : '<span class="badge badge-unverified">Unverified</span>'
  const warning = client.verified
    ? ''
    : `<p class="warning">This application registered itself and its name has not been
verified by anyone. Only continue if you recognise the address above.</p>`
  return `<div class="identity">
${badge}
${originMarkup}
${claimedName}
${warning}
</div>`
}

/**
 * The accept/deny handler.
 *
 * Script rather than a plain form submit because `/api/auth/oauth2/consent`
 * speaks JSON in and JSON out, answering `{ redirect_uri }` rather than a 302.
 * The `<noscript>` branch in the document says so plainly instead of leaving a
 * dead button.
 */
const CONSENT_SCRIPT = `
(function () {
  var node = document.getElementById('oauth-consent-query')
  var oauthQuery = JSON.parse(node.textContent)
  var errorNode = document.getElementById('oauth-consent-error')
  var buttons = [
    document.getElementById('oauth-consent-allow'),
    document.getElementById('oauth-consent-deny'),
  ]
  function submit(accept) {
    buttons.forEach(function (button) { button.disabled = true })
    errorNode.textContent = ''
    fetch('/api/auth/oauth2/consent', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accept: accept, oauth_query: oauthQuery }),
    })
      .then(function (response) { return response.json() })
      .then(function (payload) {
        if (payload && payload.redirect_uri) {
          window.location.href = payload.redirect_uri
          return
        }
        throw new Error('no redirect')
      })
      .catch(function () {
        buttons.forEach(function (button) { button.disabled = false })
        errorNode.textContent = 'Could not complete the authorization. Please try again.'
      })
  }
  buttons[0].addEventListener('click', function () { submit(true) })
  buttons[1].addEventListener('click', function () { submit(false) })
})()
`

/**
 * Render the complete, self-contained consent document.
 *
 * @param client - the requesting client, as stored, not as claimed
 * @param request - requested scopes and the signed query to hand back
 * @param appName - the operator's app name, for the title
 * @param colors - the app palette
 * @returns a complete HTML document
 */
export const renderOAuthConsentDocument = (
  client: OAuthConsentClient,
  request: OAuthConsentRequest,
  appName: string,
  colors: OAuthConsentColors = {}
): string => {
  const scopes =
    request.scopes.length === 0
      ? '<li><span class="scope-label">No additional access requested</span></li>'
      : request.scopes.map(scopeLine).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(`Authorize access — ${appName}`)}</title>
<style>${documentStyles(colors)}</style>
</head>
<body>
<main>
<h1>Authorize access</h1>
${renderIdentity(client)}
<h2>It is asking to</h2>
<ul>${scopes}</ul>
<div class="actions">
<button type="button" id="oauth-consent-deny">Deny</button>
<button type="button" id="oauth-consent-allow" class="primary">Allow</button>
</div>
<p class="error" id="oauth-consent-error" role="alert"></p>
<noscript><p class="warning">JavaScript is required to complete this authorization.</p></noscript>
</main>
<script type="application/json" id="oauth-consent-query">${escapeHtml(
    JSON.stringify(request.oauthQuery)
  )}</script>
<script>${CONSENT_SCRIPT}</script>
</body>
</html>
`
}
