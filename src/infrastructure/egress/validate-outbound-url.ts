/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parseIpv6Groups } from '@/domain/kernel/url/rate-limit-key'
import { isSsrfRelaxed } from '@/infrastructure/process/security-posture'

/**
 * Discriminator on `OutboundUrlIssue`. Lets ops tell legitimate intra-VPC
 * blocks (`'private-host'`) apart from misconfigured operator input
 * (`'invalid-url'`) without parsing the message string.
 */
export type OutboundUrlReason =
  'invalid-url' | 'unsupported-protocol' | 'private-host' | 'localhost' | 'link-local'

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
 *   - Localhost forms (`localhost`, `localhost.`, `127.0.0.0/8`, `::1`,
 *     `0.0.0.0`, `::`) →
 *     `'localhost'`
 *   - Link-local (169.254.0.0/16 incl. AWS metadata 169.254.169.254, IPv6
 *     fe80::/10) → `'link-local'`
 *   - RFC 1918 private IPv4 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16),
 * 0.0.0.0/8, carrier-grade NAT [internal ref]/10, 198.18.0.0/15,
 *     192.0.0.0/24, multicast and reserved 224.0.0.0/3, IPv6 unique-local
 *     (fc00::/7) and multicast (ff00::/8) → `'private-host'`
 *   - An IPv6 literal embedding an IPv4 address (`::ffff:0:0/96`, `::/96`,
 *     `64:ff9b::/96`) → whatever that IPv4 address is. Addresses are compared
 *     by value, so every spelling of one address gets one answer.
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

  // SSRF guarding is ALWAYS ON by default and relaxes ONLY under the explicit
  // `SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1` (or master `SOVRIUM_ALLOW_INSECURE`)
  // opt-out — independent of NODE_ENV and of the server's bind host. Local
  // development that legitimately targets `http://localhost:<port>` (in-process
  // mock services, the E2E mock server on 127.0.0.1:4300, the webhook receiver
  // on 127.0.0.1:4200) sets the opt-out: the E2E harness does so in
  // `[internal ref]`, and a developer wiring against a local upstream
  // sets it in their `.env`. Programmer errors (invalid URLs, non-http(s)
  // protocols) still reject because they don't depend on the opt-out.
  if (isSsrfRelaxed()) {
    return { ok: true, url: parsed }
  }

  const reason = classifyHost(normaliseHost(parsed.hostname))
  return reason === undefined ? { ok: true, url: parsed } : reject(rawUrl, reason)
}

/**
 * The hostname in the one spelling the checks below read.
 *
 * Bun's URL parser (unlike WHATWG) keeps the brackets on IPv6 hostnames
 * (`[::1]`, not `::1`), so they are stripped. A single trailing dot is the
 * fully-qualified spelling of the same name — `localhost.` resolves exactly
 * where `localhost` does — so it is dropped too; URL parsing already does that
 * for an IPv4 literal (`127.0.0.1.`) but leaves a name alone.
 */
const normaliseHost = (hostname: string): string => {
  const lower = hostname.toLowerCase()
  const bare = lower.startsWith('[') && lower.endsWith(']') ? lower.slice(1, -1) : lower
  return bare.endsWith('.') ? bare.slice(0, -1) : bare
}

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

/**
 * Refuse by NAME what needs no resolution to know: RFC 6761 makes the whole
 * `.localhost` zone loopback, and resolvers answer it (macOS does), so any name
 * under it reaches this machine. `host` is already lower-cased with one trailing
 * dot dropped by `normaliseHost`.
 */
const classifyByName = (host: string): OutboundUrlReason | undefined => {
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === 'localhost.localdomain' ||
    host === '0.0.0.0'
  ) {
    return 'localhost'
  }
  return undefined
}

/**
 * Classify an IPv6 literal by its 128-bit VALUE, never by its spelling.
 *
 * Text patterns cannot hold here: `[::ffff:127.0.0.1]`, `[::ffff:7f00:1]` and
 * `[0:0:0:0:0:ffff:127.0.0.1]` are one address, and URL parsing rewrites the
 * first into the second, which no pattern for `127.` or `::1` matches. So the
 * literal is parsed to its eight groups and every check reads those.
 *
 * An IPv6 address that EMBEDS an IPv4 address reaches that IPv4 address, so it
 * is classified as that address: IPv4-mapped `::ffff:0:0/96`, IPv4-compatible
 * `::/96` (which holds `::` itself, the unspecified address), and NAT64
 * `64:ff9b::/96`, which a NAT64 gateway translates to the IPv4 address in its
 * last 32 bits.
 */
const classifyIpv6 = (host: string): OutboundUrlReason | undefined => {
  const groups = host.includes(':') ? parseIpv6Groups(host) : undefined
  if (groups === undefined) return undefined
  if (isLoopbackIpv6(groups)) return 'localhost'
  if (embedsIpv4(groups)) return classifyEmbeddedIpv4(groups[6] ?? 0, groups[7] ?? 0)
  return IPV6_PREFIX_RANGES.find((range) => ((groups[0] ?? 0) & range.mask) === range.prefix)
    ?.reason
}

const allZero = (groups: readonly number[]): boolean => groups.every((group) => group === 0)

/** `::1`, which also sits inside `::/96` and would read as `0.0.0.1` there. */
const isLoopbackIpv6 = (groups: readonly number[]): boolean =>
  allZero(groups.slice(0, 7)) && groups[7] === 1

/** IPv4-mapped `::ffff:0:0/96`, IPv4-compatible `::/96`, or NAT64 `64:ff9b::/96`. */
const embedsIpv4 = (groups: readonly number[]): boolean => {
  const middle = groups.slice(2, 6)
  const head = groups.slice(0, 2)
  const mapped = allZero(groups.slice(0, 5)) && groups[5] === 0xff_ff
  const nat64 = groups[0] === 0x64 && groups[1] === 0xff_9b && allZero(middle)
  return mapped || nat64 || (allZero(head) && allZero(middle))
}

/** Prefixes read off the first 16-bit group. */
const IPV6_PREFIX_RANGES: readonly {
  readonly reason: OutboundUrlReason
  readonly mask: number
  readonly prefix: number
}[] = [
  { reason: 'link-local', mask: 0xff_c0, prefix: 0xfe_80 }, // fe80::/10
  { reason: 'private-host', mask: 0xfe_00, prefix: 0xfc_00 }, // fc00::/7 unique-local
  { reason: 'private-host', mask: 0xff_00, prefix: 0xff_00 }, // ff00::/8 multicast
]

/** The IPv4 address held in the last 32 bits of an IPv6 address, classified as itself. */
const classifyEmbeddedIpv4 = (high: number, low: number): OutboundUrlReason | undefined => {
  const dotted = [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.')
  return classifyByName(dotted) ?? classifyIpv4(dotted)
}

const IPV4_PRIVATE_RANGES: readonly {
  readonly reason: OutboundUrlReason
  readonly match: (a: number, b: number, c: number) => boolean
}[] = [
  { reason: 'localhost', match: (a) => a === 127 },
  { reason: 'link-local', match: (a, b) => a === 169 && b === 254 },
  { reason: 'private-host', match: (a) => a === 10 || a === 0 },
  { reason: 'private-host', match: (a, b) => a === 172 && b >= 16 && b <= 31 },
  { reason: 'private-host', match: (a, b) => a === 192 && b === 168 },
  // Carrier-grade NAT (RFC 6598): cloud and overlay networks put their own
  // internal services here — one metadata service answers at 100.100.100.200.
  { reason: 'private-host', match: (a, b) => a === 100 && b >= 64 && b <= 127 },
  // Benchmarking (RFC 2544) and IETF protocol assignments (RFC 6890).
  { reason: 'private-host', match: (a, b) => a === 198 && (b === 18 || b === 19) },
  { reason: 'private-host', match: (a, b, c) => a === 192 && b === 0 && c === 0 },
  // Multicast 224.0.0.0/4 and reserved 240.0.0.0/4, broadcast included.
  { reason: 'private-host', match: (a) => a >= 224 },
]

const classifyIpv4 = (host: string): OutboundUrlReason | undefined => {
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/)
  if (ipv4Match === null) return undefined
  const a = Number(ipv4Match[1])
  const b = Number(ipv4Match[2])
  const c = Number(ipv4Match[3])
  return IPV4_PRIVATE_RANGES.find((range) => range.match(a, b, c))?.reason
}

/**
 * Whether `hostname` names a private, loopback or link-local target.
 *
 * The same classification {@link validateOutboundUrl} applies, read WITHOUT
 * the relaxation flag in front of it. Exported because a caller can need the
 * shape of the host independently of whether the operator has opted out of the
 * guard — `sovrium init --from-url` relaxes its https-only rule for a local
 * fixture and must not relax it for a public host at the same time, and the
 * opt-out alone cannot tell those apart.
 *
 * @public
 */
export const isPrivateOutboundHost = (hostname: string): boolean =>
  classifyHost(normaliseHost(hostname)) !== undefined
