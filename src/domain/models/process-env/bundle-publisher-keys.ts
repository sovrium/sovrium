/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parsePublicKeyring } from './host-actions'
import type { BundlePublisherKey } from '@/domain/kernel/identity/bundle-publisher'

/**
 * The keys `sovrium init --from-bundle` judges a publisher signature against.
 *
 * The binary embeds the bundle-publisher public keys, the current one and the
 * next, compiled in. They are distinct from the release keys `sovrium update`
 * trusts (a leaked publisher key must not sign a binary) and from a Cloud
 * host's `SOVRIUM_BUNDLE_PUBLIC_KEYS` (a host operator and a desktop user are
 * different principals), which this module never reads.
 *
 * `SOVRIUM_INIT_BUNDLE_PUBLISHER_KEYS` (`<id>:<base64>[,…]`, the keyring
 * format of `SOVRIUM_UPDATE_SIGNING_KEYS`) REPLACES the embedded keys so a spec
 * can sign a fixture with a key it has just generated. It is honoured only for
 * an archive fetched over the network while private outbound is opted into AND
 * whose final URL's host is a loopback IP LITERAL (127.0.0.0/8, or `[::1]`).
 * A host NAME never qualifies, `localhost` included: no name is resolved, so
 * there is no gap between the address a lookup answers and the one the fetch
 * used. The opt-in is necessary, never sufficient: an instance left with the
 * master switch on still judges a bundle from any other host, and a `file:` URL
 * or a local path, against the embedded keys. The variable can never badge a
 * bundle a person was sent.
 * A malformed value throws, naming the variable; the caller refuses the import.
 */

type Env = Readonly<Record<string, string | undefined>>

/** The test seam that replaces the embedded publisher keys. */
export const SOVRIUM_INIT_BUNDLE_PUBLISHER_KEYS_VAR = 'SOVRIUM_INIT_BUNDLE_PUBLISHER_KEYS'

/**
 * The bundle-publisher public keys this binary trusts: current, then next.
 * Empty until the publisher's key pair exists; its private half is held by the
 * starter-publishing pipeline and an offline copy, never by this repository.
 */
export const EMBEDDED_BUNDLE_PUBLISHER_KEYS: readonly BundlePublisherKey[] = []

/** The four octets of a dotted IPv4 address, or `undefined`. */
const ipv4Octets = (address: string): readonly number[] | undefined => {
  const parts = address.split('.')
  if (parts.length !== 4 || !parts.every((part) => /^\d{1,3}$/.test(part))) return undefined
  const octets = parts.map(Number)
  return octets.every((octet) => octet <= 255) ? octets : undefined
}

/**
 * Whether `address` — an IP literal, brackets and a port tolerated — is a
 * loopback address: 127.0.0.0/8, `::1`, or 127.0.0.0/8
 * mapped into IPv6. A host NAME is never a loopback address here.
 */
export const isLoopbackAddress = (address: string): boolean => {
  const bare = address.replace(/^\[([^\]]+)\](?::\d+)?$/, '$1').replace(/^([\d.]+):\d+$/, '$1')
  const lower = bare.toLowerCase()
  if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true
  const mapped = /^::ffff:([\d.]+)$/.exec(lower)?.[1]
  return ipv4Octets(mapped ?? lower)?.[0] === 127
}

/** The keys an archive is judged against, given where it came from. */
export const resolveBundlePublisherKeys = (options: {
  readonly env: Env
  /**
   * The final URL's host as `URL.hostname` gives it (`127.0.0.1`, `[::1]`, a
   * name); `undefined` for a file or a path. The override needs a loopback IP
   * literal: a name is never looked up.
   */
  readonly fetchedFromHost: string | undefined
  /** Whether `SOVRIUM_ALLOW_PRIVATE_OUTBOUND` (or the master switch) is on. */
  readonly privateOutboundOptIn: boolean
}): readonly BundlePublisherKey[] => {
  const override = options.env[SOVRIUM_INIT_BUNDLE_PUBLISHER_KEYS_VAR]?.trim() ?? ''
  const honoured =
    override !== '' &&
    options.privateOutboundOptIn &&
    options.fetchedFromHost !== undefined &&
    isLoopbackAddress(options.fetchedFromHost)
  return honoured
    ? parsePublicKeyring(SOVRIUM_INIT_BUNDLE_PUBLISHER_KEYS_VAR, options.env)
    : EMBEDDED_BUNDLE_PUBLISHER_KEYS
}
