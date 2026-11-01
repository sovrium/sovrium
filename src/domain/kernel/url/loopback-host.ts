/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * True when `host` is a loopback name or address that only the local operator
 * can reach — `localhost`, the IPv4 loopback `127.0.0.0/8` and the IPv6
 * loopback `::1` (bracketed or not).
 *
 * The UNSPECIFIED addresses `0.0.0.0` and `::` are deliberately NOT loopback:
 * they are the wildcard bind, every interface the machine has, the most public
 * bind a server can choose.
 *
 * Empty or undefined reads as loopback: the unset development default, where
 * the server falls back to `localhost`.
 *
 * Pure, so the domain can decide a development seam from the environment it is
 * handed; the infrastructure posture resolver asks this same predicate.
 */
export const isLoopbackHostname = (host: string | undefined): boolean => {
  if (host === undefined || host === '') return true
  const lowered = host.trim().toLowerCase()
  const normalized =
    lowered.startsWith('[') && lowered.endsWith(']') ? lowered.slice(1, -1) : lowered
  if (normalized === 'localhost' || normalized === 'localhost.localdomain') return true
  if (normalized === '::1') return true
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalized)
}
