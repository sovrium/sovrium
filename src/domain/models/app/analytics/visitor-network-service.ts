/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** Four decimal octets, each 0-255. */
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

const ipv4Network = (address: string): string | undefined => {
  const match = IPV4.exec(address)
  if (match === null) return undefined
  const octets = match.slice(1, 5).map(Number)
  if (octets.some((octet) => octet > 255)) return undefined
  return `${octets[0]}.${octets[1]}.${octets[2]}.0`
}

/** The eight 16-bit groups of an IPv6 address, or `undefined` when it is not one. */
const ipv6Groups = (address: string): readonly number[] | undefined => {
  const halves = address.split('::')
  if (halves.length > 2) return undefined
  const parse = (half: string | undefined): readonly string[] =>
    half === undefined || half === '' ? [] : half.split(':')
  const head = parse(halves[0])
  const tail = parse(halves[1])
  const missing = 8 - head.length - tail.length
  if (halves.length === 1 ? missing !== 0 : missing < 1) return undefined
  const groups = [...head, ...Array.from({ length: missing }, () => '0'), ...tail]
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/i.test(group))) return undefined
  return groups.map((group) => Number.parseInt(group, 16))
}

/**
 * The network a client address belongs to: its IPv4 /24 or its IPv6 /48.
 *
 * Two visitors on one network get the same answer, which is the point: an
 * identifier computed from it counts a network, not a device. An IPv4-mapped
 * IPv6 address (`::ffff:203.0.113.17`) is treated as the IPv4 address it
 * carries. Anything that is not an address (empty, a host name, an address with
 * a port) gives the empty string, so every malformed value lands in one bucket
 * rather than keeping whatever it held.
 *
 * @example truncateToNetwork('203.0.113.17') // '203.0.113.0'
 * @example truncateToNetwork('2001:db8:4a:1::1') // '2001:db8:4a::'
 */
export function truncateToNetwork(address: string): string {
  const trimmed = address.trim().replace(/^\[(.*)\]$/, '$1')
  const v4 = ipv4Network(trimmed)
  if (v4 !== undefined) return v4
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(trimmed)
  if (mapped?.[1] !== undefined) return ipv4Network(mapped[1]) ?? ''
  const groups = ipv6Groups(trimmed.replace(/%.*$/, ''))
  if (groups === undefined) return ''
  // The same mapping written in hex: `::ffff:cb00:7111`
  const isMapped = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xff_ff
  if (isMapped) return `${groups[6]! >> 8}.${groups[6]! & 0xff}.${groups[7]! >> 8}.0`
  return `${groups
    .slice(0, 3)
    .map((group) => group.toString(16))
    .join(':')}::`
}
