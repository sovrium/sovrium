/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { OutboundHttp, OutboundTransportError } from '@/application/ports/services/outbound-http'
import { guardedFetch } from './guarded-fetch'
import { fetchRemoteImage } from './remote-media'

/**
 * The `OutboundHttp` port, as the guarded egress.
 *
 * A pass-through, on purpose: every guard lives in `guardedFetch` and
 * `fetchRemoteImage`, and this adapter adds none and removes none. In
 * particular it never passes `resolveHost`, so every hop's host name is
 * resolved by the machine's resolver and the hop is sent to the address that
 * was checked (`host-resolution.ts`) — the default, which the port cannot
 * switch off. A rejected `guardedFetch` (DNS, TLS, the deadline) becomes
 * `OutboundTransportError` carrying the rejection itself, so the caller's
 * classification of it is unchanged.
 */
export const OutboundHttpLive = Layer.succeed(OutboundHttp, {
  guardedFetch: (url, init, options) =>
    Effect.tryPromise({
      try: () => guardedFetch(url, init, options),
      catch: (cause) => new OutboundTransportError({ cause }),
    }),
  fetchRemoteImage: (address, options) =>
    // effect-promise: total -- `fetchRemoteImage` never rejects: `readImage` catches every failure of the guarded read and returns it as `{ ok: false, reason }`, and the cache bookkeeping after it is synchronous Map writes.
    Effect.promise(() => fetchRemoteImage(address, options)),
})
