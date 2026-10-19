/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { guardedKeyRecord } from './token-value-schemas'

/**
 * The COLOUR palette: the app's own named colour literals, and the dark-scheme
 * overrides that mirror them.
 *
 * ## Why the palette is its own key, beside `ramps` and `colorRoles`
 *
 * The consolidation proposal asked whether the palette could decode as an
 * implicit ONE-STEP ramp, leaving `design.ramps` as the only place a colour
 * value is written. It cannot, for three reasons, and the reasons are recorded
 * here because the question is a good one and will be asked again:
 *
 * 1. **A ramp step needs a step NAME.** `RampSchema` is closed over the eleven
 *    rungs `50 … 950`, so a one-step ramp has to be filed under one of them.
 *    Every candidate is an invention: `500` claims the token is mid-lightness,
 *    which for `#ffffff` is false, and inventing a twelfth rung for the purpose
 *    makes the ladder no longer a ladder.
 * 2. **The emission would change.** A palette token emits `--color-{name}`; a
 *    ramp step emits its own variable and roles resolve THROUGH it. Rewriting
 *    one as the other renames a custom property that shipped configs and
 *    hand-written CSS already reference.
 * 3. **`design.colorRoles` documenting entries point AT palette names.** The
 *    decode-time rule that catches a typo'd role name resolves it against the
 *    declared palette. With no palette there is nothing to resolve against, and
 *    a real check would have to be deleted to make the merge work.
 *
 * The three colour keys are three genuinely different jobs: `colors` is the
 * unordered set of author tokens, `ramps` is an ordered lightness ladder, and
 * `colorRoles` says what a semantic role RESOLVES TO.
 *
 * ## The KEY grammar is enforced at the RECORD level
 *
 * Effect v4's `Schema.Record` silently DROPS an entry whose KEY fails its key
 * schema — no error, no diagnostic, the value simply is not there. Measured on
 * `4.0.0`, `{ Primary: '#3b5bdb' }` decoded to `{}`. So the key schema is
 * a plain `Schema.String`, which can never fail, and the key SHAPE is asserted
 * at the record level where a malformed key survives to be named. See
 * `guardedKeyRecord`.
 */
const COLOR_NAME_PATTERN = /^[a-z]+[a-z0-9]*(-[a-z0-9]+)*$/

const COLOR_NAME_HINT =
  'A colour name is kebab-case, starting with a letter (e.g. `primary`, `text-muted`, `gray-500`).'

/**
 * Colour name in kebab-case.
 *
 * Kept as a standalone schema because the DTCG projection and the design-system
 * surfaces validate a name they were handed rather than a whole record.
 */
export const ColorNameSchema = Schema.String.pipe(
  Schema.annotate({
    title: 'Color Name',
    description: 'Color name in kebab-case format',
    examples: ['primary', 'primary-hover', 'gray-500', 'text-muted'],
  }),
  Schema.check(
    Schema.isPattern(COLOR_NAME_PATTERN, {
      message:
        'Color name must use kebab-case format: lowercase letters and numbers separated by hyphens (e.g., "primary", "text-muted", "gray-500")',
    })
  )
)

/**
 * The one shape a colour function may take: its name, ONE pair of parentheses,
 * and arguments made only of numbers, units, keywords such as `none`, and the
 * separators `,` `/` `%`. Nothing may follow the closing parenthesis.
 *
 * The argument alphabet is deliberately narrow. It has no `(` or `)`, so a
 * nested `var()` or `calc()` cannot hide inside; no `:` `;` `{` `}`, so a value
 * cannot close its own declaration and start another; and no quote, so it
 * cannot open a `url("…")`.
 */
const COLOR_FUNCTION = /^(?:rgba?|hsla?|oklch)\([0-9A-Za-z.,%/+ -]*\)$/

const HEX_COLOR = /^#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/

/**
 * A colour value in a CSS format that can be READ — and exactly ONE colour.
 *
 * Supports hex 6- and 8-digit, and one complete `rgb(`/`rgba(`, `hsl(`/`hsla(`
 * or `oklch(` call.
 *
 * ## Exactly one colour, and nothing after it
 *
 * A colour token is written verbatim into the stylesheet the app serves, as a
 * custom property every page reads. A value that merely STARTED with a colour
 * function — `rgb(0 0 0) url(https://…)`, or `oklch(…); background: …` — used
 * to pass, and carried its tail into that stylesheet: a `url()` makes every
 * visitor's browser fetch a resource the operator never chose, which is a
 * privacy and egress leak, and a `;` starts a declaration of its own. So the
 * whole value must be the colour: a hex literal, or one call whose arguments
 * hold no parenthesis, colon, semicolon, brace or quote. See
 * {@link COLOR_FUNCTION}.
 *
 * ## Why `oklch()` and not the other two
 *
 * `oklch()` is admitted because Sovrium's own default palette is written in it:
 * the neutral and semantic ramps of the v1 theme layer are `oklch()` literals,
 * and a schema that cannot express the platform's own colours cannot become the
 * home for them. It is also the only widely-shipped space in which a ramp can be
 * retuned by lightness without the hue shifting underneath, which is most of
 * what makes a ramp a ramp. Every browser Sovrium targets has supported it
 * since 2023.
 *
 * `var(` and `color-mix(` stay REFUSED, and not out of squeamishness about
 * newness. Both are REFERENCES rather than values:
 *
 * - `var(--x)` resolves against whatever the cascade holds at the point of use,
 *   so two surfaces reading one token may legitimately paint different colours.
 *   Nothing that reads this config can resolve it — not the contrast checker,
 *   not the DTCG export, not the design-system document an agent is handed.
 * - `color-mix()` is the same problem with arithmetic on top: its operands are
 *   usually `var()`s and its result is knowable only in a browser.
 *
 * The place to say "this role follows that ramp step" is a reference the schema
 * can READ — `design.colorRoles[role].value` — not a CSS function it cannot.
 *.
 */
export const ColorValueSchema = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(new RegExp(`${HEX_COLOR.source}|${COLOR_FUNCTION.source}`), {
      message:
        'Color value must be exactly ONE colour: a hex literal (#RRGGBB or #RRGGBBAA), or one complete rgb(a), hsl(a) or oklch() call with nothing after its closing parenthesis. Its arguments are numbers, units and separators only — no `url(…)`, no nested function, no `;`. `var(…)` and `color-mix(…)` are references, not values: nothing reading this config can resolve one, so a token that follows another is written as a reference the schema understands (`design.colorRoles[role].value`) rather than as CSS. See ADR-032.',
    })
  ),
  Schema.annotate({
    title: 'Color Value',
    description:
      'Exactly one colour: a hex literal (6 or 8 digits), or one complete rgb(), rgba(), hsl(), hsla() or oklch() call with nothing after it',
    howTo:
      'Write the colour and nothing else. A value such as `rgb(0 0 0) url(…)` or `oklch(0.5 0.1 250); color: red` is refused, because everything after the colour would reach the stylesheet every page loads. To follow another token, use `design.colorRoles[role].value` with a ramp reference instead of `var()`.',
    examples: [
      '#007bff',
      '#007bff80',
      'rgb(0, 123, 255)',
      'rgb(0 0 0 / 0.5)',
      'hsl(210, 100%, 50%)',
      'oklch(0.56 0.12 250)',
    ],
  })
)

/** The app's named colour literals. */
export const DesignColorsSchema = guardedKeyRecord(ColorValueSchema, {
  path: 'design.colors',
  pattern: COLOR_NAME_PATTERN,
  keyHint: COLOR_NAME_HINT,
  keyTitle: 'Color Name',
  keyExamples: ['primary', 'primary-hover', 'text-muted'],
  description:
    "The app's named colour literals. Distinct from `design.ramps` (ordered ladders) and `design.colorRoles` (what a role resolves to).",
}).pipe(
  Schema.annotate({
    identifier: 'DesignColors',
    title: 'Colour Palette',
    description:
      "The app's named colour literals. Distinct from `design.ramps` (ordered ladders) and `design.colorRoles` (what a role resolves to).",
    examples: [{ primary: '#3b5bdb', 'text-muted': 'oklch(0.56 0 0)' }],
  })
)

/**
 * The dark-scheme overrides, mirroring {@link DesignColorsSchema} key for key.
 *
 * A separate key rather than a `dark` member on each token, because the two
 * palettes are chosen as wholes: a dark scheme is a re-tuning of the set, not a
 * per-token afterthought. The per-token alternative exists one level up, as
 * `design.colorRoles[].dark`, for authors who want the light and dark value of
 * a role side by side.
 */
export const DesignDarkColorsSchema = guardedKeyRecord(ColorValueSchema, {
  path: 'design.darkColors',
  pattern: COLOR_NAME_PATTERN,
  keyHint: COLOR_NAME_HINT,
  keyTitle: 'Color Name',
  keyExamples: ['primary', 'surface'],
  description:
    "Dark-scheme overrides for `design.colors`, keyed identically. Declared with no `colorScheme`, the app follows the visitor's system scheme.",
}).pipe(
  Schema.annotate({
    identifier: 'DesignDarkColors',
    title: 'Dark Colour Palette',
    description:
      "Dark-scheme overrides for `design.colors`, keyed identically. Declared with no `colorScheme`, the app follows the visitor's system scheme.",
    examples: [{ primary: '#748ffc' }],
  })
)

/** @public */
export type ColorName = Schema.Schema.Type<typeof ColorNameSchema>
/** @public */
export type ColorValue = Schema.Schema.Type<typeof ColorValueSchema>
/** @public */
export type DesignColors = Schema.Schema.Type<typeof DesignColorsSchema>
/** @public */
export type DesignDarkColors = Schema.Schema.Type<typeof DesignDarkColorsSchema>
