/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isSsrfRelaxed } from '@/infrastructure/utils/security-posture'

export type OutboundUrlReason =
  'invalid-url' | 'unsupported-protocol' | 'private-host' | 'localhost' | 'link-local'

export interface OutboundUrlIssue {
  readonly url: string
  readonly reason: OutboundUrlReason
}

export type ValidateOutboundUrlResult =
  | { readonly ok: true; readonly url: URL }
  | { readonly ok: false; readonly issue: OutboundUrlIssue }

export function validateOutboundUrl(rawUrl: string): ValidateOutboundUrlResult {
  const parsed = parseUrl(rawUrl)
  if (parsed === undefined) return reject(rawUrl, 'invalid-url')
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return reject(rawUrl, 'unsupported-protocol')
  }

  if (isSsrfRelaxed()) {
    return { ok: true, url: parsed }
  }

  const reason = classifyHost(stripIpv6Brackets(parsed.hostname.toLowerCase()))
  return reason === undefined ? { ok: true, url: parsed } : reject(rawUrl, reason)
}

const stripIpv6Brackets = (host: string): string =>
  host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host

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
