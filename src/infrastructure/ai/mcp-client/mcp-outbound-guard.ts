/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lookup } from 'node:dns/promises'
import { Effect } from 'effect'
import {
  isPrivateOutboundHost,
  validateOutboundUrl,
  type OutboundUrlReason,
} from '@/infrastructure/egress/validate-outbound-url'
import { isSsrfRelaxed } from '@/infrastructure/process/security-posture'

/**
 * The outbound guard in front of every declared MCP server, run before the
 * first byte is sent to it.
 *
 * Two checks, both refused unless the instance opted into private outbound
 * calls (`SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1`, the same opt-out every other
 * guarded egress honours; the E2E harness sets it so its fake servers on
 * 127.0.0.1 are reachable, and a spec blanks it to see the refusal):
 *
 * 1. The URL itself (`validateOutboundUrl`): a loopback, private or link-local
 *    literal, `localhost` and its zone, and every IPv6 spelling of those.
 * 2. What the NAME resolves to: a public-looking name whose A/AAAA records
 *    point inside the network is refused too. `validateOutboundUrl` cannot see
 *    that, by design (it does no I/O).
 *
 * The lookup and the connection are two resolutions, so a name whose record
 * changes between them (DNS rebinding) is not closed here: that needs
 * connecting to the checked address, which `fetch` cannot express. The servers
 * are the operator's own declarations, which is the trust boundary this guard
 * backs up rather than replaces.
 */

export type OutboundVerdict =
  | { readonly ok: true }
  /** Refused by the guard: nothing may be sent. */
  | { readonly ok: false; readonly refused: true; readonly reason: string }
  /** The name did not resolve: the server is unavailable, not refused. */
  | { readonly ok: false; readonly refused: false; readonly reason: string }

/** Resolve a host name to its addresses. Injected so tests need no DNS. */
export type ResolveHost = (hostname: string) => Promise<readonly string[]>

export const resolveWithSystemDns: ResolveHost = async (hostname) =>
  (await lookup(hostname, { all: true })).map((entry) => entry.address)

const REASON_TEXT: Readonly<Record<OutboundUrlReason, string>> = {
  'invalid-url': 'the address is not a valid URL',
  'unsupported-protocol': 'the address is not http(s)',
  'private-host': 'the address is a private network address',
  localhost: 'the address is a loopback address',
  'link-local': 'the address is a link-local address',
}

const OPT_OUT = 'private outbound calls are not allowed on this instance'

const isIpLiteral = (hostname: string): boolean =>
  /^[\d.]+$/.test(hostname) || hostname.includes(':') || hostname.startsWith('[')

const DNS_TIMEOUT_MS = 5000

/** Judge `rawUrl` before anything is sent to it. Bounded by a lookup deadline. */
export const checkMcpServerAddress = (
  rawUrl: string,
  resolve: ResolveHost = resolveWithSystemDns
): Effect.Effect<OutboundVerdict> => {
  const validation = validateOutboundUrl(rawUrl)
  if (!validation.ok) {
    const text = REASON_TEXT[validation.issue.reason]
    const guarded =
      validation.issue.reason !== 'invalid-url' &&
      validation.issue.reason !== 'unsupported-protocol'
    return Effect.succeed({
      ok: false,
      refused: true,
      reason: guarded ? `${text}; ${OPT_OUT}` : text,
    })
  }
  const { hostname } = validation.url
  if (isSsrfRelaxed() || isIpLiteral(hostname)) return Effect.succeed({ ok: true })
  return Effect.tryPromise({
    try: () => resolve(hostname),
    catch: () => 'lookup-failed' as const,
  }).pipe(
    Effect.timeoutOrElse({
      duration: DNS_TIMEOUT_MS,
      orElse: () => Effect.fail('lookup-failed' as const),
    }),
    Effect.map((addresses): OutboundVerdict => {
      const inside = addresses.find((address) => isPrivateOutboundHost(address))
      return inside === undefined
        ? { ok: true }
        : {
            ok: false,
            refused: true,
            reason: `the name ${hostname} resolves to a private, loopback or link-local address; ${OPT_OUT}`,
          }
    }),
    // effect-swallow: a failed lookup is not lost — it becomes the server's `unavailable` status, whose reason the operator reads on the status route.
    Effect.orElseSucceed((): OutboundVerdict => ({
      ok: false,
      refused: false,
      reason: `the name ${hostname} could not be resolved`,
    }))
  )
}
