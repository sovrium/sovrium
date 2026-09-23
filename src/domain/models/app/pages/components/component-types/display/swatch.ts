/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `swatch` — one design token, drawn.
 *
 * ## Why this is a public kit type
 *
 * Drawing a token is not a console-only need. Any app documenting its own
 * design — a brand page, a style guide, a partner-facing spec — wants the same
 * chip-plus-caption, and until now the only thing that could draw one was a
 * primitive the design-system console kept to itself. `swatch` is that
 * capability, published.
 *
 * ## The variant, and why a curve belongs here
 *
 * `variant: 'curve'` plots an easing token instead of painting a colour one.
 * They look like different components and are the same one: a named token from
 * `design`, resolved and drawn at the size a reader can judge it, with its
 * value printed beside it. Keeping them apart meant two kit entries for "show
 * me what this token IS".
 *
 * The curve is a **static SVG**. It must stay one: a chart library on this path
 * would pull the visx chunk into any page documenting a duration, and a
 * four-point bezier is two `<path>` elements. `[internal ref]`
 * measures the eager closure that every visitor pays, and a swatch is a
 * server-rendered element with no island at all — it appears in no registry and
 * mounts nothing.
 *
 * ## What is read under which variant
 *
 * `source`, `showHex`, `showOklch` and `contrastAgainst` are colour keys;
 * `showValue` and `size` are curve keys. Each is inert under the other variant
 * rather than refused — one open struct, and `buildComponentUnion` has no
 * per-branch refinement hook. `token` and `label` are read under both.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const SwatchTypeLiteral = Schema.Literal('swatch')

/** What kind of token a swatch is drawing. */
export const SwatchModeSchema = Schema.Literals(['curve']).annotate({
  title: 'Swatch Mode',
  description:
    "Specialized rendering mode: 'curve' plots an easing token as a static SVG. Omit to paint a colour token.",
})

export const swatchFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  /**
   * Specialized rendering mode. Omit for a colour swatch.
   *
   * A one-member union rather than a boolean, so a second kind of token — a
   * radius, a shadow — joins the vocabulary instead of adding a second flag
   * that has to be read against the first.
   */
  variant: Schema.optional(SwatchModeSchema),
  /**
   * The token to draw.
   *
   * A colour swatch takes a `--sv-*` custom-property name or a `design.ramps`
   * step; never a literal colour, which stops being true the moment the ramp is
   * retuned. A `variant: 'curve'` swatch takes an easing token name or a
   * `cubic-bezier(...)` literal — a literal is legal there because a bezier is
   * the value itself rather than a reference to one.
   */
  token: Schema.String.pipe(
    Schema.annotate({
      title: 'Token',
      description:
        'The token to draw: a `--sv-*` custom-property name or a `design.ramps` step for a colour, or an easing name / `cubic-bezier(...)` literal under variant: curve',
      examples: ['--sv-color-primary', 'neutral-500', 'enter'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  /** Caption under the swatch. Falls back to the token name. */
  label: Schema.optional(
    Schema.String.annotate({
      description: 'Caption under the swatch (default: the token name itself)',
    })
  ),
  /**
   * WHERE the drawn colour comes from. Read under the colour variant.
   *
   * `literal` (the default) resolves the token once at render, and is the only
   * thing that works for a `design.ramps` step: a ramp entry is not emitted as
   * a CSS custom property, so there is nothing in the cascade to read.
   * `cascade` paints from the custom property itself, so the swatch follows a
   * colour-scheme switch rather than keeping the light value under a dark page.
   *
   * The kind of token is not decidable from the string — `token` is an open
   * string because `design.ramps` is an open record — so the author says which
   * they meant, and a name with no custom property behind it is reported at
   * render time rather than refused at decode.
   */
  source: Schema.optional(
    Schema.Literals(['literal', 'cascade']).annotate({
      title: 'Token Source',
      description:
        'Where the drawn colour comes from. `literal` (default) resolves the token once at render — the only thing that works for a `design.ramps` step, which has no custom property. `cascade` paints from the live CSS variable, so the swatch follows a colour-scheme switch.',
      examples: ['cascade'],
    })
  ),
  /** Print the resolved value in hexadecimal. Read under the colour variant. */
  showHex: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Print the resolved value as hex — the notation a design tool takes',
    })
  ),
  /** Print the resolved value in `oklch()`. Read under the colour variant. */
  showOklch: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Print the resolved value as `oklch()` — the notation whose first number is the lightness, so a ramp reads as a ladder',
    })
  ),
  /** The token this one is designed to sit against. Read under the colour variant. */
  contrastAgainst: Schema.optional(
    Schema.String.annotate({
      description:
        'Token this colour is designed to sit against. Adds the contrast ratio and its WCAG grade to the swatch.',
      examples: ['--sv-color-background'],
    })
  ),
  /** Print the resolved `cubic-bezier(...)` beside the plot. Read under `variant: 'curve'`. */
  showValue: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Print the resolved `cubic-bezier(...)` beside the plot — the form an author copies into a stylesheet',
    })
  ),
  /**
   * Edge of the square plot, in CSS pixels. Read under `variant: 'curve'`.
   *
   * A size and not a width/height pair: a bezier's two ordinates are both
   * normalised progress (time across, output up), so plotting it in a
   * non-square box scales the two axes differently and shows a curve steeper or
   * flatter than the one the app runs. The distortion is invisible — the
   * drawing still looks like a plausible easing — which is why the shape
   * refuses to express it rather than documenting a caution.
   */
  size: Schema.optional(
    Schema.Finite.pipe(Schema.check(Schema.isGreaterThan(0))).annotate({
      title: 'Plot Size',
      description:
        'Edge of the square plot in CSS pixels under variant: curve. Square because both bezier ordinates are normalised progress, so a non-square box would draw a curve steeper than the one the app runs.',
      examples: [64, 96],
    })
  ),
} as const
