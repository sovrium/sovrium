/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Discriminator on `OutboundUrlIssue`. Lets ops tell legitimate intra-VPC
 * blocks (`'private-host'`) apart from misconfigured operator input
 * (`'invalid-url'`) without parsing the message string.
 */
export type OutboundUrlReason =
  | 'invalid-url'
  | 'unsupported-protocol'
  | 'private-host'
  | 'localhost'
  | 'link-local'

export interface OutboundUrlIssue {
  readonly url: string
  readonly reason: OutboundUrlReason
}

/**
 * Discriminated-union result mirroring the codebase's existing
 * `RefreshResult` convention (see `infrastructure/connections/token-refresh.ts`).
 * Avoids throws so the helper plays well with `eslint-plugin-functional`'s
 * `no-throw-statements` rule and stays easy to consume from both plain
 * async code and Effect.gen pipelines.
 */
export type ValidateOutboundUrlResult =
  | { readonly ok: true; readonly url: URL }
  | { readonly ok: false; readonly issue: OutboundUrlIssue }

/**
 * Reject outbound `fetch` targets that point at internal infrastructure or
 * use protocols other than http(s). Returns a discriminated-union result;
 * callers branch on `.ok` and read either `.url` (parsed) or `.issue`
 * (with structured `reason`).
 *
 * Scope (URL-level only — no DNS resolution):
 *   - Invalid URL strings → `'invalid-url'`
 *   - Non-http/https protocols → `'unsupported-protocol'`
 *     (file://, ftp://, javascript:, data:, …)
 *   - Localhost forms (`localhost`, `127.0.0.0/8`, `::1`, `0.0.0.0`) →
 *     `'localhost'`
 *   - Link-local (169.254.0.0/16 incl. AWS metadata 169.254.169.254, IPv6
 *     fe80::/10) → `'link-local'`
 *   - RFC 1918 private IPv4 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16),
 *     0.0.0.0/8, IPv6 unique-local (fc00::/7) → `'private-host'`
 *
 * Out of scope: DNS-level SSRF — `https://internal.local` resolving to
 * 10.0.0.1 is NOT caught here because pure URL parsing has no DNS context.
 * Pure-function semantics also avoid the TOCTOU window between `validate`
 * and `fetch`. If/when the threat model demands DNS resolution, layer it on
 * top by calling `dns.lookup(parsed.hostname)` and re-validating the
 * resolved IP.
 *
 * Trust model today: every consumer (webhook dispatcher, OAuth refresh,
 * automation http/webhook actions) is fed URLs from operator-controlled
 * app config. The helper is preventive — once connections / automations
 * become end-user-creatable via the admin UI, every consumer is already
 * guarded.
 */
export function validateOutboundUrl(rawUrl: string): ValidateOutboundUrlResult {
  const parsed = parseUrl(rawUrl)
  if (parsed === undefined) return reject(rawUrl, 'invalid-url')
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return reject(rawUrl, 'unsupported-protocol')
  }

  // Outside production, accept private/loopback/link-local hosts. Local
  // development routinely targets `http://localhost:<port>` (in-process
  // mock services, the E2E mock server on 127.0.0.1:4300, the webhook
  // receiver on 127.0.0.1:4200, a developer's locally-running upstream).
  // Blocking those would break the E2E suite and make the dev server
  // unusable for any automation that wires against a local process.
  // Mirrors the established `disableCSRFCheck` convention in
  // `infrastructure/auth/better-auth/auth.ts` — production-only hardening,
  // relaxed in dev/test. Programmer errors (invalid URLs, non-http(s)
  // protocols) still reject because they don't depend on environment.
  if (process.env['NODE_ENV'] !== 'production') {
    return { ok: true, url: parsed }
  }

  const reason = classifyHost(stripIpv6Brackets(parsed.hostname.toLowerCase()))
  return reason === undefined ? { ok: true, url: parsed } : reject(rawUrl, reason)
}

// Bun's URL parser (unlike WHATWG) keeps the brackets on IPv6 hostnames
// (`[::1]`, not `::1`). Strip them so the prefix checks below operate on
// the bare form regardless of the underlying engine.
const stripIpv6Brackets = (host: string): string =>
  host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host

// eslint-disable-next-line functional/prefer-immutable-types -- URL is a Web standard interface with setters; the lint rule can't prove our consumers don't mutate it. We don't.
const parseUrl = (rawUrl: string): URL | undefined => {
  try {
    return new URL(rawUrl)
  } catch {
    return undefined
  }
}

const reject = (url: string, reason: OutboundUrlReason): ValidateOutboundUrlResult => ({
  ok: false,
  issue: { url, reason },
})

/**
 * Identify a private/internal host shape, or `undefined` for public hosts.
 * Order is significant: more-specific labels (localhost, link-local) come
 * first so `127.0.0.1` resolves to `'localhost'` rather than `'private-host'`.
 */
const classifyHost = (host: string): OutboundUrlReason | undefined =>
  classifyByName(host) ?? classifyIpv6(host) ?? classifyIpv4(host)

const classifyByName = (host: string): OutboundUrlReason | undefined => {
  if (host === 'localhost' || host === 'localhost.localdomain' || host === '0.0.0.0') {
    return 'localhost'
  }
  return undefined
}

const classifyIpv6 = (host: string): OutboundUrlReason | undefined => {
  if (host === '::1') return 'localhost'
  if (/^fe[89ab][0-9a-f]:/.test(host)) return 'link-local'
  if (/^f[cd][0-9a-f]{2}:/.test(host)) return 'private-host'
  return undefined
}

const IPV4_PRIVATE_RANGES: readonly {
  readonly reason: OutboundUrlReason
  readonly match: (a: number, b: number) => boolean
}[] = [
  { reason: 'localhost', match: (a) => a === 127 },
  { reason: 'link-local', match: (a, b) => a === 169 && b === 254 },
  { reason: 'private-host', match: (a) => a === 10 || a === 0 },
  { reason: 'private-host', match: (a, b) => a === 172 && b >= 16 && b <= 31 },
  { reason: 'private-host', match: (a, b) => a === 192 && b === 168 },
]

const classifyIpv4 = (host: string): OutboundUrlReason | undefined => {
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/)
  if (ipv4Match === null) return undefined
  const a = Number(ipv4Match[1])
  const b = Number(ipv4Match[2])
  return IPV4_PRIVATE_RANGES.find((range) => range.match(a, b))?.reason
}
