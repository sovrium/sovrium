/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { getConnInfo } from 'hono/bun'
import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { redactSecretPath } from '@/domain/kernel/url/secret-path-redaction'
import { logDebug } from '@/infrastructure/logging/logger'
import type { Context, MiddlewareHandler } from 'hono'

/**
 * The preview gate (`SOVRIUM_PREVIEW_TOKEN`): an instance that answers only to
 * a bearer of the token.
 *
 * It is the first middleware that can ANSWER a request — mounted ahead of the
 * request logger, the static files, the page-render and catalogue caches,
 * `/api/auth/*`, the realtime upgrades, `/mcp` and the inbound webhooks — so
 * nothing behind it can answer from memory before it has judged the request.
 * Every channel the instance serves goes through `Bun.serve`'s one `fetch`,
 * which hands it to Hono (WebSocket upgrades included), so one mount covers
 * them all. A new listener entry point that does not go through Hono must
 * mount this gate itself.
 *
 * - No valid cookie and no token: `404`, the ordinary not-found answer — never
 *   `401`/`403`, so nothing says a token exists.
 * - `?preview=<token>`: a valid token is answered with a `302` to the same
 *   address without `preview`, setting `__Host-sovrium-preview` to a value
 *   DERIVED from the token (a keyed digest), so a cookie read from a browser
 *   profile is not the secret, and a restart with another token turns every
 *   old cookie away. A wrong token sets nothing and answers `404`.
 * - The one exemption: `GET /api/health` from a loopback socket peer carrying
 *   no forwarding header (a proxy on the same host connects from loopback
 *   too; the headers are what tell its requests apart). It answers bare
 *   liveness, without the app block.
 * - Admitted responses carry `X-Robots-Tag: noindex`, pages the robots meta,
 *   and `/robots.txt` disallows everything.
 *
 * Comparisons are constant-time over equal-length digests. The token is never
 * logged: an answer to a request carrying `?preview=` is written to the access
 * log with the value as `***`.
 */

/** The cookie the admission sets. `__Host-` pins it to this origin, `Secure` and `Path=/`. */
export const PREVIEW_COOKIE_NAME = '__Host-sovrium-preview'

/** The query parameter the token arrives in. */
export const PREVIEW_QUERY_PARAMETER = 'preview'

/** The start-up banner line of a token-gated preview. Never names the token. */
export const PREVIEW_BANNER_LINE = 'Preview: only requests carrying the preview token are answered'

/** What `/robots.txt` answers on an admitted preview: the whole site closed. */
export const PREVIEW_ROBOTS_CONTENT = 'User-agent: *\nDisallow: /\n'

/** The headers that say a request was relayed by a proxy. */
const FORWARDING_HEADERS = ['Forwarded', 'X-Forwarded-For', 'X-Real-IP'] as const

/** The context the cookie value is derived under, so it can never equal the token. */
const COOKIE_DERIVATION_CONTEXT = 'sovrium-preview-cookie-v1'

const sha256 = (value: string): Buffer => createHash('sha256').update(value).digest()

/** Constant-time equality of two strings, whatever their lengths. */
const constantTimeEquals = (left: string, right: string): boolean =>
  timingSafeEqual(sha256(left), sha256(right))

/** The cookie value a token admits with: a keyed digest of a fixed context, base64url. */
export const previewCookieValue = (token: string): string =>
  createHmac('sha256', token).update(COOKIE_DERIVATION_CONTEXT).digest('base64url')

/** Whether a socket peer address is the machine itself (`127.0.0.0/8`, `::1`, mapped IPv4). */
export const isLoopbackPeer = (address: string | undefined): boolean => {
  if (address === undefined) return false
  const normalized = address.toLowerCase().replace(/^::ffff:/, '')
  return normalized === '::1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalized)
}

/**
 * Whether a request is the supervisor's own health probe: `GET /api/health`,
 * from a loopback peer, with no forwarding header.
 */
export const isExemptHealthProbe = (
  request: { readonly method: string; readonly path: string; readonly headers: Headers },
  peerAddress: string | undefined
): boolean =>
  request.method === 'GET' &&
  request.path === '/api/health' &&
  isLoopbackPeer(peerAddress) &&
  FORWARDING_HEADERS.every((name) => request.headers.get(name) === null)

/**
 * The same address without its `preview` parameter, as a redirect target. A
 * path the URL parser leaves starting with `//` (`GET //other.example/?preview=`)
 * would be a protocol-relative `Location` sending the bearer to another site,
 * so the target goes through the one same-site check and falls back to `/`.
 */
export const addressWithoutToken = (url: string): string => {
  const parsed = new URL(url)
  parsed.searchParams.delete(PREVIEW_QUERY_PARAMETER)
  return toSafeRedirectPath(`${parsed.pathname}${parsed.search}`) ?? '/'
}

/** The value of one cookie in a `Cookie` header, or `undefined`. */
const cookieValue = (header: string | undefined, name: string): string | undefined =>
  header
    ?.split(';')
    .map((pair) => pair.trim())
    .find((pair) => pair.startsWith(`${name}=`))
    ?.slice(name.length + 1)

/** The socket peer of the request, or `undefined` when the adapter cannot tell. */
const peerAddressOf = (c: Context): string | undefined => {
  try {
    return getConnInfo(c).remote.address
  } catch {
    // No Bun server on `c.env` (a static render): no peer, so no exemption.
    return undefined
  }
}

/** The robots meta every admitted page carries; any robots meta the page had is replaced. */
const withNoindexMeta = (response: Response): Response =>
  new HTMLRewriter()
    .on('meta[name="robots"]', {
      element: (element) => {
        element.remove()
      },
    })
    .on('head', {
      element: (element) => {
        element.prepend('<meta name="robots" content="noindex">', { html: true })
      },
    })
    .transform(response)

/** Mark an admitted response as never to be indexed. */
const markNoindex = (c: Context): void => {
  const isHtml = (c.res.headers.get('Content-Type') ?? '').includes('text/html')
  const response = isHtml ? withNoindexMeta(c.res) : c.res
  c.res = response
  c.res.headers.set('X-Robots-Tag', 'noindex')
}

/** What the gate needs beyond the token. */
export interface PreviewGateOptions {
  /** The token, already accepted by the boot check (at least 32 characters). */
  readonly token: string
  /** The platform's ordinary not-found answer for this request. */
  readonly notFound: (c: Context) => Response | Promise<Response>
  /**
   * Hand the exempt health probe to the listener's own handler instead of
   * answering bare liveness — for a listener whose health answer carries no
   * app block (the degraded listener's `503`).
   */
  readonly passHealthThrough?: boolean
}

/** A refusal: the ordinary not-found answer, never indexed. */
const refuse = async (c: Context, notFound: PreviewGateOptions['notFound']): Promise<Response> => {
  const response = await notFound(c)
  response.headers.set('X-Robots-Tag', 'noindex')
  return response
}

/** Answer `?preview=<token>`: a redirect setting the cookie, or the refusal. */
const answerAdmission = (
  c: Context,
  offered: string,
  { token, notFound }: PreviewGateOptions,
  admittedCookie: string
): Response | Promise<Response> => {
  const accepted = constantTimeEquals(offered, token)
  logDebug(
    `<-- ${c.req.method} ${redactSecretPath(c.req.path)}?preview=*** ${accepted ? 302 : 404}`
  )
  if (!accepted) return refuse(c, notFound)
  c.header(
    'Set-Cookie',
    `${PREVIEW_COOKIE_NAME}=${admittedCookie}; Secure; HttpOnly; SameSite=None; Path=/`
  )
  c.header('X-Robots-Tag', 'noindex')
  return c.redirect(addressWithoutToken(c.req.url), 302)
}

/** Whether the request carries the cookie this token admits with. */
const carriesAdmission = (c: Context, admittedCookie: string): boolean => {
  const cookie = cookieValue(c.req.header('Cookie'), PREVIEW_COOKIE_NAME)
  return cookie !== undefined && constantTimeEquals(cookie, admittedCookie)
}

/**
 * The gate middleware for one token. Inert unless mounted: the composition
 * root mounts it only when `SOVRIUM_PREVIEW_TOKEN` is set.
 */
export const previewGate = (options: PreviewGateOptions): MiddlewareHandler => {
  const admittedCookie = previewCookieValue(options.token)
  return async (c, next) => {
    const offered = c.req.query(PREVIEW_QUERY_PARAMETER)
    if (offered !== undefined) return answerAdmission(c, offered, options, admittedCookie)

    const probe = { method: c.req.method, path: c.req.path, headers: c.req.raw.headers }
    if (isExemptHealthProbe(probe, peerAddressOf(c))) {
      // Readiness has no app block; plain liveness is answered here, bare.
      if (options.passHealthThrough === true || c.req.query('probe') !== undefined) return next()
      c.header('X-Robots-Tag', 'noindex')
      return c.json({ status: 'ok' }, 200)
    }

    if (!carriesAdmission(c, admittedCookie)) return refuse(c, options.notFound)

    if (c.req.method === 'GET' && c.req.path === '/robots.txt') {
      c.header('X-Robots-Tag', 'noindex')
      return c.text(PREVIEW_ROBOTS_CONTENT, 200)
    }

    await next()
    markNoindex(c)
    return undefined
  }
}
