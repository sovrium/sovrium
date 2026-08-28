/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cause, Schema } from 'effect'

/**
 * Extract a meaningful diagnostic string from any error thrown during
 * `Effect.runPromise` / `Schema.decodeUnknownSync`. Without this helper,
 * Effect's `FiberFailure` surfaces a generic "An error has occurred" and
 * the real `Cause` / `SchemaError` / `TaggedError` details are lost — which
 * makes CLI startup failures unactionable for users.
 *
 * Used by `src/index.ts` (`start()`, `build()`) where errors caught from
 * `Effect.runPromise` are re-thrown with an enriched message. Place new
 * top-level Effect entry points alongside this helper if they need the
 * same diagnostic surfacing.
 *
 * @param error Anything caught from `Effect.runPromise` / `decodeUnknownSync`
 * @returns A human-readable diagnostic string (never throws)
 */
export const formatRuntimeError = (error: unknown): string => {
  const fromFiber = formatFromFiberFailure(error)
  if (fromFiber !== undefined) return fromFiber

  const fromTagged = formatFromTaggedError(error)
  if (fromTagged !== undefined) return fromTagged

  if (error instanceof Error) {
    return error.stack ?? error.message
  }

  return String(error)
}

/**
 * Unwrap Effect's `FiberFailure` (thrown by `Effect.runPromise` rejection)
 * via `Cause.pretty`. Returns `undefined` when the input doesn't look like
 * a `FiberFailure`, so the caller can fall through to the next strategy.
 */
const formatFromFiberFailure = (error: unknown): string | undefined => {
  if (error === null || typeof error !== 'object' || !('cause' in error)) {
    return undefined
  }
  const { cause } = error as { readonly cause: unknown }
  if (cause === null || cause === undefined || typeof cause !== 'object') {
    return undefined
  }
  try {
    return Cause.pretty(cause as Cause.Cause<unknown>)
  } catch {
    return undefined
  }
}

/**
 * Format an Effect tagged error: a `SchemaError` through its own rendered
 * `message`, or a generic `Data.TaggedError` as `[Tag] {fields…}`. Returns
 * `undefined` when the input isn't tagged.
 *
 * EFFECT 4. v3 matched `_tag === 'ParseError'` and rendered through
 * `ParseResult.TreeFormatter`. v4 renames the error to `SchemaError` and gives
 * it a `message` getter that runs the default formatter, so the narrowing moves
 * to the published guard `Schema.isSchemaError` — a string comparison on the
 * tag would keep compiling here (the value is typed `unknown`) and silently
 * stop matching, which is this migration's signature failure.
 */
const formatFromTaggedError = (error: unknown): string | undefined => {
  if (error === null || typeof error !== 'object' || !('_tag' in error)) {
    return undefined
  }
  const tagged = error as { readonly _tag: string; readonly [key: string]: unknown }

  if (Schema.isSchemaError(error)) {
    try {
      return error.message
    } catch {
      // fall through to the generic tagged-error path
    }
  }

  return formatGenericTaggedError(tagged)
}

/**
 * Fields that `Data.TaggedError` inherits from `Error` as own but
 * **NON-ENUMERABLE** properties, so `Object.entries()` cannot see them.
 *
 * Deliberately an explicit two-item list rather than
 * `Object.getOwnPropertyNames()`: the full own-property set also carries
 * engine internals (`stack`, `sourceURL`, `originalLine`, `originalColumn`,
 * `line`, `column`) which would turn every diagnostic into noise.
 */
const ERROR_SHADOWED_FIELDS = ['message', 'cause'] as const

/**
 * An `Error`-valued field `JSON.stringify`s to `{}` — information loss wearing
 * the costume of output. Render its message instead.
 */
const renderValue = (value: unknown): unknown => (value instanceof Error ? value.message : value)

/**
 * Render a generic `Data.TaggedError`-shaped object as `[Tag] {fields…}`.
 * Skips function-typed fields so methods like `toJSON` don't pollute output.
 *
 * EFFECT 4 — THE PAYLOAD IS NO LONGER FULLY ENUMERABLE. v3's `Data.Error` did
 * `Object.assign(this, args)`, making every payload field own-enumerable, so
 * `Object.entries()` saw all of them. v4 leaves `message` and `cause` as own
 * NON-ENUMERABLE properties (standard `Error` semantics) while other payload
 * keys stay enumerable. `Object.entries()` alone therefore returned just
 * `_tag`, and EVERY `Data.TaggedError`-based startup failure rendered as a bare
 * `[SchemaInitializationError]` with the actual cause gone — across ~140 error
 * sites, most of them unspec'd.
 *
 * The fix reads the two shadowed fields explicitly. It is general, not
 * migration-specific: any tagged error carrying a `message` or `cause` recovers
 * its diagnostic.
 *
 * `tsc` cannot see own-enumerability, so nothing in the type system guards
 * this. The regression tests in `format-runtime-error.test.ts` are the only
 * instrument — and note the pre-existing `{ reason }` test passes on BOTH
 * versions, because `reason` does not collide with an `Error` property. That
 * near-miss is why the guard names `message`/`cause` explicitly.
 */
const formatGenericTaggedError = (
  tagged: Readonly<{ readonly _tag: string; readonly [key: string]: unknown }>
): string => {
  const enumerableEntries = Object.entries(tagged).filter(
    ([key, value]) => key !== '_tag' && typeof value !== 'function'
  )
  const shadowedEntries = ERROR_SHADOWED_FIELDS.map(
    (key) => [key, tagged[key]] as readonly [string, unknown]
  ).filter(([, value]) => value !== undefined && value !== '' && typeof value !== 'function')

  const props = Object.fromEntries(
    [...enumerableEntries, ...shadowedEntries].map(
      ([key, value]) => [key, renderValue(value)] as const
    )
  )
  const propsStr = Object.keys(props).length > 0 ? ` ${JSON.stringify(props)}` : ''
  return `[${tagged._tag}]${propsStr}`
}
