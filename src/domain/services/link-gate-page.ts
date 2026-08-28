/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The interstitial a password-gated link answers instead of redirecting.
 *
 * A pure string function, alongside `qr-code.ts`, for the reason that matters
 * here: the security property of this page is a property of its OUTPUT, and a
 * pure function is the only shape a test can pin it on. The page must never
 * contain the destination — a gate that leaked the URL in a `Location` header,
 * a form action, or a comment would protect nothing while looking like it did —
 * and this module is given no way to leak it, because it is never told what the
 * destination is.
 *
 * Deliberately NOT a React island and deliberately not themed. It is a plain
 * form on a path a visitor reached from outside the app, so it must render with
 * no client bundle, no CSS compile, and no session.
 */

/** Escape the five characters that can break out of HTML text or an attribute. */
const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

/**
 * Render the gate.
 *
 * @param slug - The link's slug, used only to post back to the same address.
 * @param failed - Whether a wrong password was just submitted.
 */
export const renderLinkGatePage = (slug: string, failed: boolean): string => {
  const action = `/l/${encodeURIComponent(slug)}`
  const title = escapeHtml('Password required')
  const error = failed
    ? '<p role="alert" data-testid="link-gate-error" class="error">That password is not correct.</p>'
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title}</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;color:#0f172a}
form{background:#fff;padding:2rem;border-radius:.5rem;box-shadow:0 1px 3px rgb(0 0 0/.1);width:100%;max-width:22rem}
h1{font-size:1.125rem;margin:0 0 .5rem}
p{font-size:.875rem;color:#475569;margin:0 0 1rem}
.error{color:#b91c1c}
input,button{width:100%;box-sizing:border-box;padding:.5rem .75rem;font-size:1rem;border-radius:.375rem}
input{border:1px solid #cbd5e1;margin-bottom:.75rem}
button{border:0;background:#0f172a;color:#fff;cursor:pointer}
</style>
</head>
<body>
<form method="post" action="${escapeHtml(action)}" data-testid="link-gate">
<h1>${title}</h1>
<p>This link is protected. Enter the password to continue.</p>
${error}
<label for="link-gate-password" hidden>Password</label>
<input id="link-gate-password" type="password" name="password" autocomplete="current-password" autofocus required>
<button type="submit">Continue</button>
</form>
</body>
</html>`
}
