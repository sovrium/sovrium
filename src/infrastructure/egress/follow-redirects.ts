/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Fetch a document over a redirect chain where every hop is a new decision.
 *
 * ## Why this exists
 *
 * `validateOutboundUrl` runs once, on the URL the operator typed, and
 * `withFetchTimeout` never set `redirect` — so `fetch` followed up to twenty hops
 * with no guard in front of any of them. Both places that fetch a CONFIG had the
 * same hole: `sovrium init --from-url` and `APP_SCHEMA=<url>`. The document
 * fetched becomes the whole application, so the effect was that every refusal
 * those commands advertise — https only, no private or loopback target — was
 * decided against the first URL while the bytes came from the last.
 *
 * ## Why not `redirect: 'error'`
 *
 * It is simpler and it is wrong. `raw.githubusercontent.com` answers a `302`, so
 * refusing every redirect breaks every GitHub-hosted template and every published
 * gallery link. A gallery link that stops working is a broken product rather than
 * a hardened one, so redirects are FOLLOWED — under a cap, with the guard in front
 * of each hop.
 *
 * ## What is checked, and where the scheme rule applies
 *
 * Per hop: the SSRF guard, then the scheme. Both against the hop's own URL, not
 * against the one before it.
 *
 * The scheme rule applies to HOPS ONLY, and that is a decision rather than an
 * omission. The operator chose the initial URL and each caller already has its own
 * policy for it — `--from-url` requires https and says why, `APP_SCHEMA` accepts
 * whatever the deployment points it at. A hop is chosen by the PUBLISHER, so
 * `https` is required there whatever the entry point was, with the same single
 * relaxation the rest of the egress surface uses: plain `http` to a private or
 * loopback host under `SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1`, which is what makes a
 * local fixture reachable at all.
 *
 * ## What is NOT checked
 *
 * DNS. `validateOutboundUrl` classifies the hostname as written and resolves
 * nothing, so a hop to `https://internal.example` that resolves to `10.0.0.1` is
 * permitted — the same documented gap the guard has on a first-party URL, not a
 * new one. Closing it needs resolve-then-connect-to-the-resolved-address, which
 * `fetch` cannot express.
 *
 * ## The deadline is per hop
 *
 * `withFetchTimeout` builds its own `AbortController` and deliberately refuses a
 * caller-supplied signal, so the timeout passed here bounds each request rather
 * than the chain. The worst case is therefore `MAX_REDIRECT_HOPS + 1` times the
 * timeout — bounded, and the reason the cap is small.
 */

import {
  isPrivateOutboundHost,
  validateOutboundUrl,
} from '@/infrastructure/egress/validate-outbound-url'
import { withFetchTimeout } from '@/infrastructure/egress/with-fetch-timeout'

/**
 * How many redirects are followed before the chain is refused.
 *
 * Five, against `fetch`'s own twenty. A published document is served directly or
 * behind one or two redirects — `raw.githubusercontent.com` uses one, a shortener
 * plus a CDN uses two — so five leaves ordinary hosting alone while an unbounded
 * follow is a loop amplifier whose length the publisher picks.
 *
 * @public
 */
export const MAX_REDIRECT_HOPS = 5

/** Why a chain was refused, for a caller that reports rather than reads. @public */
export type RedirectRefusalReason =
  'too-many-hops' | 'blocked-host' | 'insecure-scheme' | 'missing-location'

/**
 * The outcome of following a chain.
 *
 * A refusal carries a finished sentence rather than parts: the two callers report
 * it differently (one exits 1, one throws at boot) but neither composes it, and a
 * message assembled twice is a message that comes to differ.
 *
 * @public
 */
export type RedirectFollowResult =
  | { readonly ok: true; readonly response: Response; readonly finalUrl: string }
  | {
      readonly ok: false
      readonly reason: RedirectRefusalReason
      readonly message: string
    }

/** The 3xx codes that carry a `Location` a client is expected to follow. */
const REDIRECT_STATUSES: ReadonlySet<number> = new Set([301, 302, 303, 307, 308])

/**
 * Whether plain `http` is acceptable for a hop to this host.
 *
 * Deliberately the same two conditions `--from-url` applies to its entry point,
 * and both are load-bearing. The flag alone is not enough: the E2E harness sets it
 * globally so its loopback fixtures are reachable, and a rule that read only the
 * flag would quietly allow a hop to `http://example.com` under it.
 */
const allowsPlainHttpHop = (hostname: string): boolean =>
  process.env.SOVRIUM_ALLOW_PRIVATE_OUTBOUND === '1' && isPrivateOutboundHost(hostname)

/** Refuse a hop whose scheme the operator never agreed to. */
// eslint-disable-next-line functional/prefer-immutable-types -- URL is a Web standard interface with setters, so the immutability lint reads it as mutable; nothing here writes to it (same exemption as `with-fetch-timeout.ts`)
const schemeRefusal = (from: string, to: URL): RedirectFollowResult | undefined => {
  if (to.protocol === 'https:') return undefined
  if (to.protocol === 'http:' && allowsPlainHttpHop(to.hostname)) return undefined
  return {
    ok: false,
    reason: 'insecure-scheme',
    message:
      `${from} redirected to ${to.href}, which is not https, so nothing was fetched.\n` +
      `A redirect hop is chosen by the publisher rather than by you, and a cleartext hop hands\n` +
      `the document to whoever is on the path. Ask them for an https address.`,
  }
}

/** Refuse a hop the SSRF guard declines. */
const guardRefusal = (from: string, to: string): RedirectFollowResult | undefined => {
  const validation = validateOutboundUrl(to)
  if (validation.ok) return undefined
  return {
    ok: false,
    reason: 'blocked-host',
    message:
      `${from} redirected to ${to}, which is blocked: ${validation.issue.reason} targets are not\n` +
      `allowed (SSRF guard). Every redirect hop is checked, not only the address you gave.\n` +
      `Set SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1 to permit private/loopback targets.`,
  }
}

/**
 * Discard an intermediate response's body.
 *
 * A `302` usually has none, but a host may send one, and an uncancelled stream
 * holds its socket for as long as the process lives. `catch` because cancelling a
 * body that is already done is not an error worth propagating over a redirect.
 */
const discardBody = async (response: Response): Promise<void> => {
  // eslint-disable-next-line functional/no-expression-statements -- releasing the socket produces no value; the whole effect IS the side effect
  await response.body?.cancel().catch(() => undefined)
}

/**
 * One request, then either the answer or the next decision. Recursive rather than
 * a loop so the hop budget is a parameter instead of mutable state.
 */
const requestHop = async (
  // eslint-disable-next-line functional/prefer-immutable-types -- URL is a Web standard interface with setters, so the immutability lint reads it as mutable; nothing here writes to it (same exemption as `with-fetch-timeout.ts`)
  url: URL,
  origin: string,
  timeoutMs: number,
  hopsLeft: number
): Promise<RedirectFollowResult> => {
  const response = await withFetchTimeout(url, { redirect: 'manual' }, timeoutMs)

  if (!REDIRECT_STATUSES.has(response.status)) {
    return { ok: true, response, finalUrl: url.href }
  }

  const location = response.headers.get('location')
  await discardBody(response)

  if (location === null || location === '') {
    return {
      ok: false,
      reason: 'missing-location',
      message:
        `${url.href} answered HTTP ${response.status} with no Location header, so there is\n` +
        `nowhere to follow and nothing was fetched.`,
    }
  }

  if (hopsLeft === 0) {
    return {
      ok: false,
      reason: 'too-many-hops',
      message:
        `${origin} redirected more than ${MAX_REDIRECT_HOPS} times, so nothing was fetched.\n` +
        `A published document is served directly or behind a redirect or two; a longer chain is\n` +
        `a loop or a redirector, and following it lets whoever controls the last hop choose the\n` +
        `document you get.`,
    }
  }

  // Relative `Location` is legal and common, so it is resolved against the URL it
  // came from rather than against the origin the operator typed.
  const next = URL.parse(location, url.href)
  if (!next) {
    return {
      ok: false,
      reason: 'missing-location',
      message: `${url.href} redirected to "${location}", which is not a URL, so nothing was fetched.`,
    }
  }

  return (
    guardRefusal(url.href, next.href) ??
    schemeRefusal(url.href, next) ??
    (await requestHop(next, origin, timeoutMs, hopsLeft - 1))
  )
}

/**
 * Fetch `url`, following at most {@link MAX_REDIRECT_HOPS} redirects and deciding
 * each one afresh.
 *
 * The caller has already validated `url` itself — this adds nothing to the first
 * request, and every guarantee it makes is about the hops after it. A rejected
 * promise is a transport failure (DNS, TLS, the timeout firing) and stays the
 * caller's to report, exactly as it was before the chain was followed here.
 *
 * @public
 */
export const fetchFollowingRedirects = async (
  // eslint-disable-next-line functional/prefer-immutable-types -- URL is a Web standard interface with setters, so the immutability lint reads it as mutable; nothing here writes to it (same exemption as `with-fetch-timeout.ts`)
  url: URL,
  timeoutMs: number
): Promise<RedirectFollowResult> => requestHop(url, url.href, timeoutMs, MAX_REDIRECT_HOPS)
