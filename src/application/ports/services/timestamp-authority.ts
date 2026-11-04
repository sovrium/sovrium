/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The outside timestamp authority a deployment names (`SIGNATURE_TSA_URL`):
 * an RFC 3161 server that signs "these bytes existed at this time".
 *
 * `authority` is the URL, or `undefined` when none is configured.
 * `stamp(imprint)` asks it to stamp a SHA-256 imprint and resolves to the
 * token (DER), checked before it is returned: granted, over that imprint,
 * echoing the request's nonce, signed by a certificate allowed to stamp time.
 * Anything else (no answer in time, a redirect, an error status, a token for
 * other bytes or another request) fails with {@link TimestampFailure}, and the
 * caller leaves the request it was sealing to be retried.
 */

import { Context, Data, type Effect } from 'effect'

/** The authority gave no usable token. */
export class TimestampFailure extends Data.TaggedError('TimestampFailure')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class TimestampAuthority extends Context.Service<
  TimestampAuthority,
  {
    readonly authority: Effect.Effect<string | undefined>
    readonly stamp: (imprint: Uint8Array) => Effect.Effect<Uint8Array, TimestampFailure>
  }
>()('TimestampAuthority') {}
