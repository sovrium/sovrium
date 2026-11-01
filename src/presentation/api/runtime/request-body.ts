/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect, type Schema } from 'effect'
import { decodeSafe, type SafeDecodeResult } from '@/domain/kernel/config-parsing/decode'
import type { Context } from 'hono'

/** A JSON request body as read, and as decoded against its wire contract. */
export interface DecodedJsonBody<A> {
  /**
   * The body as sent, `undefined` when it is not JSON at all. Kept for the
   * routes that read past the contract (a sparse patch's key presence, a size
   * pre-screen with its own answer); everything else reads `decoded`.
   */
  readonly raw: unknown
  /** The body decoded against the route's `src/domain/models/api/` schema. */
  readonly decoded: SafeDecodeResult<A>
}

/**
 * Read a JSON request body and decode it against its wire contract.
 *
 * The read never throws: a body that is not JSON reads as `undefined`, which no
 * request schema accepts, so the route answers it with the same refusal as a
 * body of the wrong shape. The caller chooses that answer; this decodes only.
 *
 * @param c - the request context.
 * @param schema - the route's request schema in `src/domain/models/api/`.
 */
export const decodeJsonBody = async <S extends Schema.Top>(
  c: Context,
  schema: S
): Promise<DecodedJsonBody<S['Type']>> => {
  const raw: unknown = await c.req.json().catch(() => undefined)
  return { raw, decoded: decodeSafe(schema)(raw) }
}

/** A form post whose body the runtime could not read. */
class FormBodyReadError extends Data.TaggedError('FormBodyReadError')<{
  readonly cause: unknown
}> {}

/**
 * A form post's body, as a step of a handler's program. A body the runtime
 * cannot read fails with its cause, for the handler's failure answer.
 */
export const readFormBody = (c: Context) =>
  Effect.tryPromise({
    try: () => c.req.parseBody(),
    catch: (cause) => new FormBodyReadError({ cause }),
  })
