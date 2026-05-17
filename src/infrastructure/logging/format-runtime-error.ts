/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cause } from 'effect'
import { TreeFormatter } from 'effect/ParseResult'

/**
 * Extract a meaningful diagnostic string from any error thrown during
 * `Effect.runPromise` / `Schema.decodeUnknownSync`. Without this helper,
 * Effect's `FiberFailure` surfaces a generic "An error has occurred" and
 * the real `Cause` / `ParseError` / `TaggedError` details are lost — which
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
 * Format an Effect tagged error: `ParseError` via `TreeFormatter` for indented
 * schema diagnostics, or generic `Data.TaggedError` as `[Tag] {fields…}`.
 * Returns `undefined` when the input isn't tagged.
 */
const formatFromTaggedError = (error: unknown): string | undefined => {
  if (error === null || typeof error !== 'object' || !('_tag' in error)) {
    return undefined
  }
  const tagged = error as { readonly _tag: string; readonly [key: string]: unknown }

  if (tagged._tag === 'ParseError' && 'issue' in tagged) {
    try {
      return TreeFormatter.formatErrorSync(error as never)
    } catch {
      // fall through to the generic tagged-error path
    }
  }

  return formatGenericTaggedError(tagged)
}

/**
 * Render a generic `Data.TaggedError`-shaped object as `[Tag] {fields…}`.
 * Skips function-typed fields so methods like `toJSON` don't pollute output.
 */
const formatGenericTaggedError = (
  tagged: Readonly<{ readonly _tag: string; readonly [key: string]: unknown }>
): string => {
  const props = Object.fromEntries(
    Object.entries(tagged).filter(([key]) => key !== '_tag' && typeof tagged[key] !== 'function')
  )
  const propsStr = Object.keys(props).length > 0 ? ` ${JSON.stringify(props)}` : ''
  return `[${tagged._tag}]${propsStr}`
}
