/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export const CLIENT_IP_FALLBACK = '127.0.0.1'

export interface ClientIpInput {
  readonly forwardedFor: string | undefined
  readonly realIp: string | undefined
  readonly cfConnectingIp: string | undefined
  readonly socketPeer: string | undefined
  readonly trustedProxyHops: number
}

export const parseForwardedForChain = (header: string | undefined): readonly string[] =>
  header === undefined
    ? []
    : header
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry !== '')

const presentOrUndefined = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed === undefined || trimmed === '' ? undefined : trimmed
}

export const resolveTrustedForwardedIp = (input: {
  readonly forwardedFor: string | undefined
  readonly realIp: string | undefined
  readonly cfConnectingIp: string | undefined
  readonly trustedProxyHops: number
}): string | undefined => {
  if (input.trustedProxyHops <= 0) return undefined

  const cloudflare = presentOrUndefined(input.cfConnectingIp)
  if (cloudflare !== undefined) return cloudflare

  const realIp = presentOrUndefined(input.realIp)
  if (realIp !== undefined) return realIp

  const chain = parseForwardedForChain(input.forwardedFor)
  return chain[chain.length - input.trustedProxyHops]
}

export const resolveClientIp = (input: ClientIpInput): string =>
  resolveTrustedForwardedIp(input) ?? presentOrUndefined(input.socketPeer) ?? CLIENT_IP_FALLBACK

export const hasUntrustedForwardingHeader = (input: {
  readonly forwardedFor: string | undefined
  readonly realIp: string | undefined
  readonly cfConnectingIp: string | undefined
  readonly trustedProxyHops: number
}): boolean =>
  input.trustedProxyHops <= 0 &&
  (presentOrUndefined(input.forwardedFor) !== undefined ||
    presentOrUndefined(input.realIp) !== undefined ||
    presentOrUndefined(input.cfConnectingIp) !== undefined)
