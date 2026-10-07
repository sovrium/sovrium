/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'

/**
 * Tagged failure raised when an action body cannot be serialised — most
 * commonly because the YAML payload contains a circular reference or a
 * `BigInt`, both of which throw from `JSON.stringify` synchronously. The
 * tag lets callers `catch`/`either` against this specific failure
 * instead of merging it into a generic `Error` bucket on the Effect
 * channel, while `cause` preserves the original throwable for
 * log-level diagnostics.
 */
export class BodySerializationError extends Data.TaggedError('BodySerializationError')<{
  readonly message: string
  readonly cause: unknown
}> {}

/**
 * Serialise an action's `props.body` to the on-the-wire string form.
 *
 * Bodies in YAML config are intentionally polymorphic — Slack, Discord,
 * PagerDuty, and custom consumers all expect different payload shapes —
 * so there is no single Effect Schema we can validate against. We pass
 * strings through verbatim (caller already chose the wire format) and
 * `JSON.stringify` everything else.
 *
 * Wrapped in `Effect.try` so that pathological inputs (circular
 * references, BigInt values) surface as a typed `BodySerializationError`
 * the caller can convert to a graceful `{ status: 'failure', error }`
 * outcome — instead of crashing the surrounding `Effect.gen` as a
 * defect.
 *
 * Callers that want to treat `null` like an absent body (webhook) should
 * normalise upstream; this helper passes `null` through to JSON.stringify
 * (which yields the literal string `"null"`).
 */
export const serializeActionBody = (
  rawBody: unknown
): Effect.Effect<string | undefined, BodySerializationError> => {
  if (rawBody === undefined || typeof rawBody === 'string') {
    return Effect.succeed(rawBody)
  }
  return Effect.try({
    // Schema would be ceremonial here: props.body is intentionally
    // polymorphic user-supplied YAML (no single shape applies).
    try: () => JSON.stringify(rawBody),
    catch: (cause) =>
      new BodySerializationError({
        message: `failed to serialise body: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      }),
  }).pipe(Effect.withSpan('automations.serialize-action-body'))
}
