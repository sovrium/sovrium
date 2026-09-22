/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data } from 'effect'

/**
 * A connection store operation that did not complete.
 *
 * One tagged failure across the connection and token repositories, replacing an
 * earlier `mapError((err) => new Error(...))` that collapsed every repository
 * failure into the global `Error` type and left the failure channel with nothing
 * to discriminate on (Effect diagnostic `globalErrorInEffectFailure`).
 *
 * `operation` names the call site, so a log line says which of six writes broke
 * rather than only that one did; `cause` preserves the original error so
 * root-cause information survives the boundary. Neither reaches the client — the
 * OAuth endpoints answer with their own RFC 6749-shaped envelopes.
 */
export class ConnectionStoreError extends Data.TaggedError('ConnectionStoreError')<{
  readonly operation: string
  readonly cause: unknown
}> {}
