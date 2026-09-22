/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The values the four design-console components REPORT, computed away from the
 * JSX that prints them.
 *
 * Each of the four exists to state a fact about the design system — a resolved
 * token, a contrast ratio, the literal that produced a drawing — so the
 * computation is the component, and the markup is presentation of it. Keeping
 * them apart is also what keeps `design-components.tsx` inside the 300-line cap
 * React components are held to.
 */

import { measureContrast } from '@/domain/kernel/color/color-contrast'
import { DEFAULT_SV_LIGHT_VALUES } from '@/domain/models/app/design/default-design.generated'
import { RAMP_STEPS } from '@/domain/models/app/design/ramps'
import type { Design } from '@/domain/models/app/design'
import type { Component } from '@/domain/models/app/pages/components'

/** `<ramp>-<step>` — the reference shape `design.ramps` steps are named by. */
const RAMP_REF = new RegExp(`^([a-z][a-z0-9]*(?:-[a-z0-9]+)*)-(${RAMP_STEPS.join('|')})$`)

/** A colour written out rather than named. */
const COLOUR_LITERAL = /^(#|rgba?\(|hsla?\(|oklch\(|oklab\()/i

/**
 * How many `<ramp>-<step>` hops to follow before giving up.
 *
 * A ramp step may reference another ramp's step, and the default palette is
 * full of those — but a cycle is expressible, and a swatch that hangs is worse
 * than one that reports nothing. Four is past the deepest chain the default
 * palette declares and nowhere near an accidental limit.
 */
const MAX_RAMP_HOPS = 4

/** One `--sv-*` token's default light value, or `undefined`. */
const platformToken = (name: string): string | undefined =>
  DEFAULT_SV_LIGHT_VALUES[name.replace(/^--sv-/, '').replace(/^sv-/, '')]

/**
 * The colour a token names, as the app currently paints it.
 *
 * Resolution order is the cascade's: what the operator declared in a ramp,
 * then what they declared in `theme.colors`, then the platform's own `--sv-*`
 * default. A literal is returned as itself, because a contrast badge accepts
 * one by contract — a brand page comparing an incoming colour against the page
 * ground has no token for it yet.
 *
 * `undefined` for anything unresolvable, and the caller prints nothing rather
 * than a colour it half-understood: a swatch showing the wrong green is worse
 * than one saying it could not resolve the token.
 */
export const resolveColorToken = (design: Design | undefined, token: string): string | undefined =>
  followToken(design, token, 0, [])

/** The value a `<ramp>-<step>` reference names, when the app declares one. */
const rampStep = (design: Design | undefined, name: string): string | undefined => {
  const ref = RAMP_REF.exec(name)
  if (ref === null) return undefined
  const ramps = design?.ramps as
    Readonly<Record<string, Readonly<Record<string, string>>>> | undefined
  const value = ramps?.[ref[1] ?? '']?.[ref[2] ?? '']
  return typeof value === 'string' ? value : undefined
}

/** The value `theme.colors` gives a name, when the app declares one. */
const themeColor = (design: Design | undefined, name: string): string | undefined => {
  const value = design?.colors?.[name]
  return typeof value === 'string' ? value : undefined
}

/**
 * One hop of the resolution, carrying the names already visited.
 *
 * `seen` is a parameter rather than a mutable set for the ordinary reason —
 * this file is pure — and it is needed at all because a ramp step may reference
 * another ramp's step and a cycle is expressible in config. A swatch that hangs
 * is worse than one that reports nothing.
 */
const followToken = (
  design: Design | undefined,
  name: string,
  hops: number,
  seen: readonly string[]
): string | undefined => {
  if (hops > MAX_RAMP_HOPS || seen.includes(name)) return undefined
  if (COLOUR_LITERAL.test(name)) return name

  const next = [...seen, name]
  const referenced = rampStep(design, name) ?? themeColor(design, name)
  return referenced === undefined
    ? platformToken(name)
    : followToken(design, referenced, hops + 1, next)
}

/** A contrast verdict stated against the bar it was graded at. */
export interface ContrastVerdict {
  /** `17.40:1` — the measurement, which the threshold does not change. */
  readonly ratio: string
  /** `AA` / `AAA` when it clears the bar, `fails AA` / `fails AAA` when not. */
  readonly grade: string
  /** Whether it cleared the requested bar. */
  readonly passes: boolean
}

/** The two WCAG bars, at normal body-text size. See the schema for why no more. */
const BAR: Readonly<Record<string, number>> = { AA: 4.5, AAA: 7 }

/**
 * Measure one pair and grade it against the requested bar.
 *
 * The ratio is a FACT and the grade is a judgement of it, so the threshold
 * changes only the second: the same pair graded at AAA still reports the same
 * number, which is what lets a reader see how far short a failure falls.
 *
 * `undefined` when either colour is not understood — the badge then says so
 * rather than printing a ratio computed from a guess.
 */
export const gradeContrast = (
  foreground: string,
  background: string,
  threshold: string
): ContrastVerdict | undefined => {
  const measured = measureContrast(foreground, background)
  if (measured === undefined) return undefined

  const bar = BAR[threshold] ?? BAR['AA'] ?? 4.5
  const passes = measured.ratio >= bar
  return {
    ratio: `${measured.ratio.toFixed(2)}:1`,
    grade: passes ? threshold : `fails ${threshold}`,
    passes,
  }
}

// ---------------------------------------------------------------------------
// The specimen snippet
// ---------------------------------------------------------------------------

/** A config value that prints as itself rather than as a block to walk into. */
type Scalar = string | number | boolean

const isScalar = (value: unknown): value is Scalar =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'

/** One indent level of the emitted block. */
const INDENT = '  '

/**
 * The component definition, as the config an author would write.
 *
 * Hand-rolled rather than routed through a YAML serialiser, for the reason the
 * console's own anatomy panel gives: this is a READING surface, and the output
 * has to stay a short quotation-free block that looks like the config file. A
 * general serialiser emits correct YAML with quoting and anchors a reader then
 * has to decode.
 *
 * `props` is omitted at the top level and nowhere else. A specimen's `props`
 * carries the test hook and the layout classes the PAGE needed to place the
 * drawing — never anything the reader should copy — so printing it would
 * document the kit page rather than the component.
 */
const serialise = (value: unknown, depth: number): readonly string[] => {
  const pad = INDENT.repeat(depth)
  if (isScalar(value)) return [`${pad}${String(value)}`]

  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (isScalar(entry)) return [`${pad}- ${String(entry)}`]
      const [first, ...rest] = serialise(entry, depth + 1)
      return first === undefined ? [] : [`${pad}- ${first.trimStart()}`, ...rest]
    })
  }

  if (typeof value !== 'object' || value === null) return []

  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => {
    if (key === 'props' && depth === 0) return []
    if (isScalar(entry)) return [`${pad}${key}: ${String(entry)}`]
    const nested = serialise(entry, depth + 1)
    return nested.length === 0 ? [] : [`${pad}${key}:`, ...nested]
  })
}

/**
 * The config literal that produced one drawing.
 *
 * Projected from the SAME declaration the renderer drew, which is the whole
 * point of the component: a kit page that wrote the example twice has two
 * sources of truth for one fact and they drift on the first edit.
 */
export const specimenSnippet = (component: Component): string => serialise(component, 0).join('\n')
