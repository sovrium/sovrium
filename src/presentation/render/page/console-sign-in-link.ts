/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { escapeHtml } from '@/domain/kernel/markdown/markdown-renderer'

/** What the console's way back to signing in is drawn with. */
export interface ConsoleSignInLink {
  /** The console's sign-in page, e.g. `/_admin/login`. */
  readonly loginPath: string
  /** The link's text, in the reader's language. */
  readonly label: string
}

/** How each way on (a link, the sign-out button) is drawn: the app's primary text link. */
const WAY_CLASS = 'font-medium text-primary underline-offset-4 hover:underline'

/** The id the link is found by, by the script that names the address asked for. */
const LINK_ID = 'sovrium-console-sign-in'

/**
 * A JavaScript string literal for `value`, safe inside an inline `<script>`:
 * `JSON.stringify` quotes it, and `<` is escaped so no `</script>` can close it.
 */
const scriptString = (value: string): string => JSON.stringify(value).replaceAll('<', '\\u003c')

/**
 * The not-found document a console address answers a caller it does not admit,
 * with ONE "Sign in" link to the console's sign-in page added.
 *
 * The SERVER document is the same for every address under the console base —
 * one the console serves and one it does not — so it names no page: the link is
 * drawn to the bare sign-in page, and a two-line script then names the address
 * the browser asked for as `?next=`, so signing in returns the operator there.
 * The address is never echoed into the server's bytes, and it travels URL-encoded
 * into a query parameter of a fixed path, so the link itself can lead nowhere
 * but the console's sign-in page; the sign-in page holds `next` to a page of the
 * console (`toSafeRedirectPath`) before following it. Without scripts, the link
 * still signs in, landing on the console's home.
 *
 * The link sits at the end of the document's `<main>` (else of its `<body>`),
 * pinned to the bottom of the viewport, so it shows on the default not-found
 * page and on an operator's own `/404` alike without disturbing either layout.
 */
export function withConsoleSignInLink(html: string, link: ConsoleSignInLink): string {
  const anchor =
    `<p class="fixed inset-x-0 bottom-0 py-6 text-center text-sm">` +
    `<a id="${LINK_ID}" class="${WAY_CLASS}" ` +
    `href="${escapeHtml(link.loginPath)}">${escapeHtml(link.label)}</a></p>`
  const script =
    `<script>(function(){var a=document.getElementById(${scriptString(LINK_ID)});` +
    `if(a)a.setAttribute("href",${scriptString(link.loginPath)}+"?next="+` +
    `encodeURIComponent(location.pathname+location.search))})()</script>`
  return insertAtEnd(html, `${anchor}${script}`)
}

/** `block` at the end of the document's `<main>`, else of its `<body>`, else appended. */
function insertAtEnd(html: string, block: string): string {
  const at = html.lastIndexOf('</main>')
  if (at !== -1) return `${html.slice(0, at)}${block}${html.slice(at)}`
  const bodyEnd = html.lastIndexOf('</body>')
  return bodyEnd === -1
    ? `${html}${block}`
    : `${html.slice(0, bodyEnd)}${block}${html.slice(bodyEnd)}`
}

/** What a signed-in caller the console does not admit is offered instead of Sign in. */
export interface ConsoleSignedInWays {
  /** The "Go to the app" link's text, in the reader's language. */
  readonly toAppLabel: string
  /** The "Sign out" button's text, in the reader's language. */
  readonly signOutLabel: string
}

/** The id the sign-out button is found by, by the script that wires it. */
const SIGN_OUT_ID = 'sovrium-console-sign-out'

/**
 * The not-found document a console address answers a SIGNED-IN caller it does
 * not admit (a member, a viewer), with the two ways on that fit a session that
 * exists: "Go to the app", a link to the app's root — never back into the
 * console — and "Sign out", a button that ends the session and reloads the
 * address, which then answers as it does any anonymous visitor.
 *
 * The bytes are the same for every console address, the one the console serves
 * and the one it does not, so the page still says nothing about which exist.
 * Without scripts the button does nothing; the link still leads out.
 */
export function withConsoleSignedInWays(html: string, ways: ConsoleSignedInWays): string {
  const block =
    `<p class="fixed inset-x-0 bottom-0 flex items-center justify-center gap-6 py-6 text-sm">` +
    `<a class="${WAY_CLASS}" href="/">` +
    `${escapeHtml(ways.toAppLabel)}</a>` +
    `<button type="button" id="${SIGN_OUT_ID}" class="${WAY_CLASS}">` +
    `${escapeHtml(ways.signOutLabel)}</button></p>` +
    `<script>(function(){var b=document.getElementById(${scriptString(SIGN_OUT_ID)});` +
    `if(b)b.addEventListener("click",function(){fetch("/api/auth/sign-out",{method:"POST",` +
    `headers:{"Content-Type":"application/json"},body:"{}"}).finally(function(){location.reload()})})})()</script>`
  return insertAtEnd(html, block)
}
