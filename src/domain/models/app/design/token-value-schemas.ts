/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * The scalar VALUE grammars every design foundation ladder is built from, and
 * the record wrapper that turns one into a named ladder.
 *
 * **Not the same file as `token-value-dtcg-service.ts`**, its sibling in this
 * directory. Both were spelled `token-values.ts` before the layout programme
 * renamed them — this one at `domain/models/app/design/`, that one at
 * `domain/services/design-system/` — which is why both now say what they are.
 * This file holds Effect Schema DEFINITIONS: the grammars an authored value
 * must match to decode, imported by the six foundation schemas beside it
 * (`breakpoints`, `colors`, `elevation`, `motion`, `radius`, `spacing`). That
 * one is a SERIALISER with no schema in it: it turns an already-decoded CSS
 * string into the W3C DTCG structured form for export, and is reached only from
 * the admin design-system use-cases. Neither imports the other.
 *
 * ## Why this file exists
 *
 * `design.scales` invented these patterns and a `scaleRecord` helper for its
 * seven ladders. The foundation keys — `design.spacing`, `design.motion` — are
 * the same ladders under their purpose's own name, so they need the same
 * grammars, and they take them from here rather than from a second copy.
 *
 * **`design.scales` has NOT been folded in, and saying so matters.** It keeps
 * its own private copies, so `DIMENSION_PATTERN` currently exists twice and the
 * tracking grammar three times — and those three are not even identical:
 * `scales.ts` admits a bare `0` where `type-scale.ts` does not. Collapsing them
 * is a real follow-up rather than a rename, because `scaleRecord` bakes the
 * `design.scales.<path>` prefix into every key-shape message it emits, so the
 * merge has to decide what those messages say. Left for its own change.
 *
 * ## The record-level check is load-bearing
 *
 * Effect v4's `Schema.Record` **silently DROPS** an entry whose KEY fails its
 * key schema — no error, no diagnostic, the value simply is not there. So a key
 * schema would tell the author the config is valid while the step reached
 * nothing, which is the exact defect the `design.scales` module was written to
 * end. Every ladder here therefore keys on a plain `Schema.String`, which can
 * never fail, and checks the key SHAPE at the RECORD level where a malformed
 * key survives to be named in the message.
 */

/**
 * A number with `px` or `rem` — the two units DTCG's `dimension` type permits.
 *
 * Used by font sizes and by every spacing step. A fluid `clamp(…)` is refused
 * deliberately: fluid type is a layout technique belonging to the element that
 * needs it, whereas a ladder is a set of fixed, quotable steps.
 */
export const DIMENSION_PATTERN = /^-?(?:\d+\.?\d*|\.\d+)(?:px|rem)$/

/** A CSS time: a number with `ms` or `s`. */
export const DURATION_PATTERN = /^\d+(?:\.\d+)?(?:ms|s)$/

/**
 * A CSS easing: a four-number `cubic-bezier()`, a `steps()`, or a keyword.
 *
 * `cubic-bezier` is listed first because it is the only form that maps onto
 * DTCG's `cubicBezier` type faithfully; a keyword has no four-number form, and
 * translating one into the bezier the spec says it equals would be an
 * interpretation rather than a projection.
 */
export const EASING_PATTERN =
  /^cubic-bezier\(|^steps\(|^(?:linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end)$/

/**
 * A ladder step name: kebab-case, digits allowed anywhere.
 *
 * Digits are the whole point — `2xs`, `4`, `0-5` and `px` are all real steps in
 * the default ladder, and it is exactly the digit that `SpacingConfigSchema`'s
 * key pattern refuses.
 */
export const LADDER_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Wrap a value schema in a record whose keys are open but SHAPE-CHECKED.
 *
 * @param value - The schema every step's value must satisfy
 * @param path - The full config path, quoted verbatim in the key-shape message
 * @param keyTitle - JSON Schema title for the key node
 * @param keyExamples - Representative step names for the published schema
 */
export const ladderRecord = <S extends Schema.Top>(
  value: S,
  path: string,
  keyTitle: string,
  keyExamples: readonly string[]
): Schema.Codec<Readonly<Record<string, S['Type']>>, Readonly<Record<string, S['Encoded']>>> =>
  Schema.Record(
    Schema.String.annotate({
      title: keyTitle,
      description: 'Scale step name — becomes the suffix of the generated utility',
      examples: [...keyExamples],
    }),
    value
  ).pipe(
    Schema.check(
      Schema.makeFilter((entries: Readonly<Record<string, unknown>>) => {
        const offender = Object.keys(entries).find((name) => !LADDER_KEY_PATTERN.test(name))
        if (offender === undefined) return true
        return `\`${path}\` declares the step '${offender}', which is not a usable scale key. A step name is lowercase letters, digits and hyphens (\`2xs\`, \`4\`, \`0-5\`, \`px\`) — it becomes the suffix of a generated utility, so a name that cannot appear in a class name reaches nothing.`
      })
    )
  ) as never

/**
 * A record whose keys are open at the SCHEMA level and checked at the RECORD
 * level, for a foundation whose values are free-form CSS strings.
 *
 * ## Why this exists rather than a re-export of the theme record
 *
 * The five theme-block records — `colors`, `spacing`, `shadows`, `borderRadius`,
 * `breakpoints` — all key on a CHECKED `Schema.String`, and Effect v4 silently
 * DROPS an entry whose key fails a key schema. Measured on `4.0.0-rc.108`,
 * `onExcessProperty: 'error'` set:
 *
 * ```
 * borderRadius { Rounded: '1rem' }  → DECODED as {}
 * shadows      { Card: 'none' }     → DECODED as {}
 * breakpoints  { 'md-wide': '…' }   → DECODED as {}
 * colors       { Primary: '#…' }    → DECODED as {}
 * spacing      { '4': '1rem' }      → DECODED as {}
 * ```
 *
 * Values still throw; only keys vanish. So a config with one capitalised radius
 * name is told it is valid, and the radius is gone — no error, no diagnostic,
 * no rendered token. That is the exact defect `design.scales`, `design.ramps`
 * and `design.colorRoles` were each arranged to avoid, and a foundation key
 * that re-exported the theme record would be born carrying it.
 *
 * Wrapping the existing record in a check does NOT work, and the reason is worth
 * stating: the check runs after the decode, by which point the offending key has
 * already been dropped and the checker sees `{}`. The key schema has to be a
 * plain `Schema.String` — which can never fail, so nothing is ever dropped — and
 * the shape has to be asserted where the key still exists.
 *
 * ## What changes for an existing config
 *
 * Nothing, for any config whose keys are well-formed: same keys, same values,
 * same emission, byte-identical CSS. A config with a malformed key is told about
 * it instead of silently losing the token. That is strictly more information
 * about a config that was already broken.
 */
const EMPTY_RETIRED_KEYS: ReadonlyMap<string, string> = new Map()

export const guardedKeyRecord = <S extends Schema.Top>(
  value: S,
  options: {
    readonly path: string
    readonly pattern: RegExp
    readonly keyHint: string
    readonly keyTitle: string
    readonly keyExamples: readonly string[]
    /**
     * Keys this foundation once accepted and no longer does, each mapped to the
     * sentence that names its replacement.
     *
     * Checked BEFORE the grammar, and that order is the whole point: a retired
     * key is usually still well formed, so the grammar filter would either pass
     * it through or — once it is dropped from `pattern` — refuse it with the
     * generic "not a usable key" hint, which names the offence and not the
     * remedy. An author who wrote the key when it worked needs the remedy.
     *
     * Same contract as `removed-keys.ts` one level up, which does this for a
     * removed PROPERTY of a Struct; this is the same duty for a removed KEY of
     * an open record, where no excess-property report ever fires because every
     * string is a structurally valid key.
     */
    readonly retiredKeys?: ReadonlyMap<string, string>
  }
): Schema.Codec<Readonly<Record<string, S['Type']>>, Readonly<Record<string, S['Encoded']>>> =>
  Schema.Record(
    Schema.String.annotate({
      title: options.keyTitle,
      description: options.keyHint,
      examples: [...options.keyExamples],
    }),
    value
  ).pipe(
    Schema.check(
      Schema.makeFilter((entries: Readonly<Record<string, unknown>>) => {
        const names = Object.keys(entries)
        const retired = options.retiredKeys ?? EMPTY_RETIRED_KEYS
        const retiredOffender = names.find((name) => retired.has(name))
        if (retiredOffender !== undefined) return retired.get(retiredOffender) ?? true
        const offender = names.find((name) => !options.pattern.test(name))
        if (offender === undefined) return true
        return `\`${options.path}\` declares '${offender}', which is not a usable key. ${options.keyHint}`
      })
    )
  ) as never

/** One rung of a spacing or font-size ladder. */
export const DimensionValueSchema = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(DIMENSION_PATTERN, {
      message: 'A dimension must be a number followed by `px` or `rem` (e.g. `0.25rem`, `1px`).',
    })
  ),
  Schema.annotate({ title: 'Dimension', examples: ['0.25rem', '1px'] })
)

/** One rung of a motion duration ladder. */
export const DurationValueSchema = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(DURATION_PATTERN, {
      message: 'A duration must be a number followed by `ms` or `s` (e.g. `180ms`).',
    })
  ),
  Schema.annotate({ title: 'Duration', examples: ['0ms', '180ms'] })
)

/** One entry of a motion easing set. */
export const EasingValueSchema = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(EASING_PATTERN, {
      message:
        'An easing must be a `cubic-bezier(…)`, a `steps(…)`, or a CSS keyword (`linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`, `step-start`, `step-end`).',
    })
  ),
  Schema.annotate({ title: 'Easing', examples: ['cubic-bezier(0.2, 0, 0, 1)', 'linear'] })
)
