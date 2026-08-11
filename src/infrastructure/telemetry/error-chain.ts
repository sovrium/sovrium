/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Bounded, cycle-safe `Error.cause` traversal shared by every telemetry sink
 *.
 *
 * Sovrium wraps errors heavily — a single `DatabaseError` construction
 * pattern accounts for ~60 call sites across 19 modules, and each one passes the
 * originating driver/database failure as `cause`. `Error.prototype.stack` does
 * NOT include a nested cause's message or stack, so ANY sink that reads only
 * `err.message`/`err.stack` sees the wrapper and nothing else: the operation
 * that failed, but never why.
 *
 * That is not a formatting nicety. It made the root cause of a live incident
 * permanently unrecoverable — absent from the error backend AND from stderr
 * (hence journald), because both sinks independently read one level deep. The
 * traversal therefore lives HERE, once, and every sink walks the same chain
 * under the same bounds instead of re-deriving it.
 *
 * Everything here is PURE (no I/O, no module state) and TOTAL (never throws) —
 * telemetry must never affect the request it observes, and a reporter that threw
 * while serializing would not merely degrade a report, it would drop it.
 */

/**
 * Number of links RENDERED for a chain. Matches the default of upstream
 * Sentry's `LinkedErrors` integration and keeps a long chain from inflating a
 * payload or a log line.
 */
const MAX_CHAIN_LENGTH = 5

/**
 * Hard bound on the WALK itself — purely defensive against a pathological or
 * adversarial chain, and deliberately far above `MAX_CHAIN_LENGTH` so that the
 * root cause is still REACHED on any realistic chain before output is
 * compressed.
 *
 * Beyond this depth the deepest link reached is retained in the root's place and
 * is NOT necessarily the true root; the elision count still tells the reader the
 * chain was cut.
 */
const HARD_WALK_CAP = 50

/**
 * Coerce any thrown/caused value into an `Error`, TOTALLY.
 *
 * `String(value)` is NOT total — it throws on a null-prototype object
 * (`Object.create(null)`) and on a symbol. Since the reporter drops the entire
 * crash report when serialization throws, a bare `String()` here would trade a
 * diagnosable event for silence, which is the exact failure mode this module
 * exists to prevent.
 */
export const toError = (value: unknown): Readonly<Error> => {
  if (value instanceof Error) return value
  try {
    return new Error(String(value))
  } catch {
    return new Error('[uncoercible cause]')
  }
}

/**
 * Walk the chain NEWEST-first (the error itself, then its cause, ...), bounded
 * by `HARD_WALK_CAP` and guarded against cycles.
 *
 * `seen` holds every OBJECT already visited, so a mutually-referential pair
 * (`a.cause = b; b.cause = a`) or a self-cause terminates instead of recursing
 * forever. Primitives are deliberately not tracked: they cannot participate in a
 * reference cycle, and a coerced primitive carries no `cause` of its own, so it
 * always ends the walk.
 *
 * An EXPLICIT `null` cause is treated as "no cause" rather than coerced into a
 * bogus `"null"` link.
 */
const walk = (
  err: Readonly<Error>,
  seen: ReadonlySet<unknown>,
  remaining: number
): ReadonlyArray<Readonly<Error>> => {
  const { cause } = err as { readonly cause?: unknown }
  const isCycle = typeof cause === 'object' && cause !== null && seen.has(cause)
  if (remaining <= 1 || cause === undefined || cause === null || isCycle) return [err]
  return [err, ...walk(toError(cause), new Set([...seen, cause]), remaining - 1)]
}

/** A chain resolved for output: the links to render plus how many were dropped. */
export interface CauseChain {
  /** NEWEST-first — the thrown error at index 0, the ROOT CAUSE last. */
  readonly links: ReadonlyArray<Readonly<Error>>
  /** Intermediate links dropped between the outermost run and the root. */
  readonly elided: number
}

/**
 * Resolve an error's `cause` chain for output, retaining BOTH ENDS.
 *
 * A chain longer than `MAX_CHAIN_LENGTH` is compressed to the outermost
 * `MAX_CHAIN_LENGTH - 1` links PLUS the root, never to a simple prefix. Both
 * ends are load-bearing and neither may be dropped:
 *
 *   - the ROOT is the whole point of walking the chain at all. Keeping a plain
 *     prefix would discard it precisely on deep chains, where the interesting
 *     failure is furthest from the surface — the worst case, silently.
 *   - the OUTERMOST link is what the error backend titles and GROUPS an issue
 *     by (it is the last element of `exception.values[]`). Biasing the other way
 *     would preserve the root but silently re-group every existing issue.
 *
 * The middle is therefore what gives, and `elided` reports how much — an elided
 * chain must be distinguishable from a complete one, never silently shortened.
 */
export const resolveCauseChain = (error: unknown): CauseChain => {
  const err = toError(error)
  const walked = walk(err, new Set([err]), HARD_WALK_CAP)
  const root = walked.at(-1)
  if (walked.length <= MAX_CHAIN_LENGTH || root === undefined) {
    return { links: walked, elided: 0 }
  }
  return {
    links: [...walked.slice(0, MAX_CHAIN_LENGTH - 1), root],
    elided: walked.length - MAX_CHAIN_LENGTH,
  }
}

/**
 * Human-readable count of dropped links, shared by every sink so a compressed
 * chain reads the same in the terminal and in the error backend.
 */
export const elidedLabel = (elided: number): string =>
  `${elided} intermediate link${elided === 1 ? '' : 's'} elided`

/** One chain link as text: its full stack, or a header when no stack exists. */
const describeLink = (err: Readonly<Error>): string =>
  err.stack ?? `${err.name || 'Error'}: ${err.message}`

/**
 * Render an error and its causes for a TERMINAL/journald reader, in the
 * conventional wrapper-then-`Caused by:` shape:
 *
 * ```
 * DatabaseError: Failed to create record in projects
 *     at ...
 * Caused by: Error: SQLITE_CONSTRAINT: NOT NULL constraint failed
 *     at ...
 * ```
 *
 * stdout/journald is the operator's last-resort record — it survives an error
 * backend being down, misconfigured, or never enabled at all — so it must carry
 * the full chain, not just the outermost wrapper.
 *
 * A compressed chain marks the gap explicitly, immediately before the retained
 * root, so a reader can tell a cut chain from a complete one:
 *
 * ```
 * Error: outermost
 * Caused by: Error: …
 * … 2 intermediate links elided …
 * Caused by: Error: the root cause
 * ```
 */
export const formatErrorChain = (error: unknown): string => {
  const { links, elided } = resolveCauseChain(error)
  const rendered = links.map((link, index) =>
    index === 0 ? describeLink(link) : `Caused by: ${describeLink(link)}`
  )
  const rootLine = rendered.at(-1)
  if (elided === 0 || rootLine === undefined) return rendered.join('\n')
  return [...rendered.slice(0, -1), `… ${elidedLabel(elided)} …`, rootLine].join('\n')
}
