/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { judgeHost, systemResolveHost } from '@/infrastructure/egress/host-resolution'
import type { AddressRefusal } from './browser-host-guard'

/**
 * The browser guard's second look at an address: what its host NAME resolves
 * to. `addressRefusal` judges the spelling; a name such as
 * `intranet.example.com` spells nothing private and may still point at
 * `10.0.0.5`. This asks the engine's resolver — the one every other outbound
 * request goes through, test hint included — and refuses the address when any
 * answer is a private, loopback or link-local address, unless the operator
 * allows private outbound calls.
 *
 * Only a name that RESOLVES privately is refused here. A name nothing answers
 * is left to the browser, which fails to open it on its own, and a proxy does
 * not change the verdict: the answer, not the route, is what is refused.
 *
 * The browser resolves the name again itself when it connects, so a name that
 * changes its answer between the two lookups is not caught: a browser running
 * as a separate service still belongs on a network with no route to private
 * ranges.
 */
export const resolvedAddressRefusal = async (url: string): Promise<AddressRefusal | undefined> => {
  const parsed = URL.parse(url)
  if (parsed === null || !/^https?:$/.test(parsed.protocol)) return undefined
  const verdict = await judgeHost(parsed, systemResolveHost)
  return verdict.kind === 'refused' && verdict.detail === 'resolved'
    ? { kind: 'private', url, reason: 'private-host' }
    : undefined
}

/**
 * The `allowedHosts` entries a page may still open a connection to once their
 * names are resolved: an entry whose name resolves to a private, loopback or
 * link-local address is dropped, unless the operator allows private outbound
 * calls. A WebSocket is never paused by the request interception, so the
 * document's `connect-src`, built from this list, is the only place such a name
 * can be stopped. A wildcard entry (`*.example.com`) names no host to resolve
 * and keeps the spelling check `browserDocumentPolicy` applies to every entry.
 */
export const resolvedConnectableHosts = async (
  allowedHosts: readonly string[]
): Promise<readonly string[]> => {
  const kept = await Promise.all(
    allowedHosts.map(async (entry) => {
      const host = entry.trim()
      if (host.startsWith('*.')) return true
      return (await resolvedAddressRefusal(`http://${host}/`)) === undefined
    })
  )
  return allowedHosts.filter((_, index) => kept[index] === true)
}
