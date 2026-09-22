/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Resolving an easing token to the curve an app actually moves on.
 *
 * ─── ONE RESOLVER, TWO CALLERS, AND THAT IS THE POINT ──────────────────────
 *
 * The decode-time refusal (`design-console-component-validation.ts`) and the
 * renderer (`design-components.tsx`) both have to answer "does this token name
 * a curve, and which one". Two copies of that answer drift in exactly one
 * direction: boot accepts a name the renderer cannot draw, and the page shows
 * an empty box — which reads to a reader as "this one is linear", the specific
 * and wrong belief the refusal exists to prevent. So the membership test and
 * the resolution are one function, and the validator asks it the same question
 * the renderer will.
 *
 * ─── THE CONTROL POINTS ARE RECOVERED, NEVER RE-DECLARED ───────────────────
 *
 * `bezierControlPoints` parses the four ratios out of the resolved value. A
 * plot drawn from a hand-kept table of paths would satisfy "a curve appeared"
 * and rot the first time the default design was retuned, so nothing downstream
 * of here is allowed to know a curve's shape without having read its value.
 *
 * Source: src/domain/models/app/pages/components/component-types/display/swatch.ts
 * Specs: [internal ref]
 */

import { DEFAULT_SCALE_VALUES } from '@/domain/models/app/design/default-design.generated'

/** `cubic-bezier(...)` — the one form a curve may be written out as. */
const CUBIC_BEZIER = /^cubic-bezier\(([^)]*)\)$/i

/** The `--sv-ease-` / `--ease-` prefixes an easing token is emitted under. */
const EASE_PREFIXES = ['--sv-ease-', '--ease-'] as const

/**
 * The four curves every Sovrium app moves on, declared or not.
 *
 * Derived from the generated scale table rather than written out, so the set
 * gains a curve the moment the default design does. A hand-kept copy of four
 * names is the kind of second source of truth that is right on the day it is
 * typed and silently wrong afterwards.
 */
export const INHERITED_EASING_CURVES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(DEFAULT_SCALE_VALUES)
    .filter(([key]) => key.startsWith('ease-'))
    .map(([key, value]) => [key.slice('ease-'.length), value])
)

/** The names of the inherited curves, sorted — the list a refusal quotes back. */
export const INHERITED_EASING_NAMES: ReadonlySet<string> = new Set(
  Object.keys(INHERITED_EASING_CURVES)
)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The easing NAME a token refers to, with either custom-property prefix removed. */
export const easingNameOf = (token: string): string => {
  const trimmed = token.trim()
  const prefix = EASE_PREFIXES.find((candidate) => trimmed.startsWith(candidate))
  return prefix === undefined ? trimmed : trimmed.slice(prefix.length)
}

/** Whether a token is a curve written out rather than a name. */
export const isEasingLiteral = (token: string): boolean => CUBIC_BEZIER.test(token.trim())

/**
 * The four control-point ratios of a `cubic-bezier(x1, y1, x2, y2)`.
 *
 * `undefined` for anything that is not four finite numbers, so a caller draws
 * nothing rather than a path built from `NaN`.
 */
export const bezierControlPoints = (value: string): readonly number[] | undefined => {
  const match = CUBIC_BEZIER.exec(value.trim())
  if (match === null) return undefined
  const parts = (match[1] ?? '').split(',').map((part) => Number(part.trim()))
  return parts.length === 4 && parts.every((part) => Number.isFinite(part)) ? parts : undefined
}

/**
 * Whether a written-out curve is one a browser would run.
 *
 * Four finite numbers, and the two x ordinates inside `0..1`. The y ordinates
 * are deliberately unbounded: a curve that overshoots is a real easing and the
 * platform ships one — `emphasized` peaks at `1.1`.
 */
export const isDrawableBezier = (raw: string): boolean => {
  const parts = bezierControlPoints(raw)
  if (parts === undefined) return false
  const inRange = (ordinate: number | undefined): boolean =>
    ordinate !== undefined && ordinate >= 0 && ordinate <= 1
  return inRange(parts[0]) && inRange(parts[2])
}

/**
 * Every easing curve the app can resolve: the inherited four, plus whatever
 * `design.motion.easings` declares.
 *
 * One position, so one read. This took TWO arguments — the two accepted
 * spellings of the token block — and merged them, which was correct only
 * because a decode rule guaranteed at most one was present. The curve set now
 * has a single home and the guarantee is structural.
 *
 * @param motion - the `design.motion` block, unvalidated.
 */
export const resolvableEasingCurves = (motion: unknown): Readonly<Record<string, string>> => {
  const declared = (() => {
    if (!isRecord(motion)) return []
    const { easings } = motion
    if (!isRecord(easings)) return []
    return Object.entries(easings).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  })()
  return { ...INHERITED_EASING_CURVES, ...Object.fromEntries(declared) }
}

/**
 * The `cubic-bezier(...)` a token names, as the app currently moves.
 *
 * A literal resolves to itself — it is not a snapshot of a token, it IS the
 * curve, so there is no indirection left to drift. `undefined` when a name
 * resolves to nothing, and the caller draws nothing rather than a curve it
 * half-understood.
 */
export const resolveEasingCurve = (
  token: string,
  curves: Readonly<Record<string, string>>
): string | undefined => (isEasingLiteral(token) ? token.trim() : curves[easingNameOf(token)])
