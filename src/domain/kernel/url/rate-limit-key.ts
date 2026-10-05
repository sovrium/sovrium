/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The rate-limit key for a client address — the block one client controls,
 * not the one address it happened to use.
 *
 * An IPv4 address is its own key. An IPv6 client is handed a whole /64 by its
 * connection and can pick a fresh address inside it for every request, so an
 * IPv6 address is keyed by its /64: the first four groups, normalised (any
 * case, compressed or written out in full, a `%zone` suffix dropped) so every
 * spelling of one block is one key. An IPv4-mapped address (`::ffff:a.b.c.d`)
 * is keyed as the IPv4 address it carries — truncating it to a /64 would fold
 * every IPv4 client into one block.
 *
 * Only the KEY is truncated. Anything that stores or shows an address keeps
 * the full one from `resolveClientIp`.
 *
 * A value that is not a parseable address is returned unchanged (trimmed): a
 * limiter must still land it in SOME bucket, and its own raw spelling is the
 * narrowest one available.
 */

const HEX_GROUP = /^[0-9a-f]{1,4}$/i
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

/** The four octets of a dotted IPv4 address, or `undefined` when it is not one. */
const parseIpv4 = (value: string): readonly number[] | undefined => {
  const match = IPV4.exec(value)
  if (match === null) return undefined
  const octets = match.slice(1).map(Number)
  return octets.every((octet) => octet <= 255) ? octets : undefined
}

/**
 * One side of a `::`, as 16-bit groups; a trailing dotted IPv4 counts as two,
 * and is accepted only on the side that ends the address (`endsAddress`).
 */
const parseGroups = (side: string, endsAddress: boolean): readonly number[] | undefined => {
  if (side === '') return []
  const parts = side.split(':')
  const last = parts[parts.length - 1] ?? ''
  const dotted = last.includes('.')
  const embedded = dotted && endsAddress ? parseIpv4(last) : undefined
  if (dotted && embedded === undefined) return undefined
  const hexParts = embedded === undefined ? parts : parts.slice(0, -1)
  if (!hexParts.every((part) => HEX_GROUP.test(part))) return undefined
  const hexGroups = hexParts.map((part) => parseInt(part, 16))
  return embedded === undefined
    ? hexGroups
    : [...hexGroups, (embedded[0]! << 8) | embedded[1]!, (embedded[2]! << 8) | embedded[3]!]
}

/** The eight 16-bit groups of an IPv6 address, or `undefined` when it is not one. */
export const parseIpv6Groups = (value: string): readonly number[] | undefined => {
  const halves = value.split('::')
  if (halves.length > 2) return undefined
  // A dotted IPv4 is only ever the LAST 32 bits: before a `::` it is not an address.
  const head = parseGroups(halves[0] ?? '', halves.length === 1)
  const tail = halves.length === 2 ? parseGroups(halves[1] ?? '', true) : []
  if (head === undefined || tail === undefined) return undefined
  if (halves.length === 1) return head.length === 8 ? head : undefined
  const missing = 8 - head.length - tail.length
  return missing >= 1 ? [...head, ...Array.from({ length: missing }, () => 0), ...tail] : undefined
}

/** Whether eight groups spell `::ffff:a.b.c.d`, the IPv4-mapped block. */
const isIpv4Mapped = (groups: readonly number[]): boolean =>
  groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xff_ff

const mappedIpv4Of = (groups: readonly number[]): string => {
  const high = groups[6] ?? 0
  const low = groups[7] ?? 0
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.')
}

/** Strip the brackets a URL host wraps IPv6 in, and a `%zone` suffix. */
const bareAddress = (value: string): string => {
  const unbracketed = value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value
  const zone = unbracketed.indexOf('%')
  return zone === -1 ? unbracketed : unbracketed.slice(0, zone)
}

/**
 * The key every per-address rate limit counts `address` under.
 *
 * - IPv4 → unchanged (`198.51.100.20`)
 * - IPv4-mapped IPv6 → the IPv4 address (`::ffff:198.51.100.20` → `198.51.100.20`)
 * - IPv6 → its /64 (`2001:0DB8:04A1:07C0:FFFF::1` → `2001:db8:4a1:7c0::/64`)
 * - anything else → unchanged, trimmed
 */
export const toRateLimitKey = (address: string): string => {
  const trimmed = address.trim()
  if (!trimmed.includes(':')) return trimmed
  const groups = parseIpv6Groups(bareAddress(trimmed))
  if (groups === undefined) return trimmed
  if (isIpv4Mapped(groups)) return mappedIpv4Of(groups)
  return `${groups
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(':')}::/64`
}
