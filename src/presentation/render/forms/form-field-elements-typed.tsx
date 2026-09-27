/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The hosted-form parts that follow a TYPED column or carry no answer at all —
 * the required mark every label shares, the rating scale, and a section's
 * heading — split out of `form-field-elements.tsx` to keep that file under its
 * size cap.
 *
 * A hosted form document mounts no React island: the inline runtime
 * (`form-runtime.tsx`) is all the script it carries. So the rating here is the
 * `RatingScale` CONTRACT drawn with native radios rather than the island
 * itself — a radio group named by the label, one radio per rank named
 * "n of max", the same glyphs and the same tones — and the runtime supplies the
 * two behaviours native radios lack: choosing the chosen rank again clears it,
 * and the glyphs up to the chosen rank are drawn filled.
 */

import {
  computeRatingGlyphClasses,
  computeRatingRankClasses,
  computeRatingRowClasses,
  DEFAULT_RATING_MAX,
  ratingGlyphsFor,
} from '@/presentation/design/cell-affordances-default-classes'
import {
  computeFormFieldClasses,
  computeFormGroupLabelClasses,
  computeFormHelpTextClasses,
  computeFormRequiredMarkClasses,
} from '@/presentation/design/form-layout-classes'
import { ariaRequired, FIELD_LABEL_CLASS, fieldWrapperAttributes } from './form-field-chrome'
import { DescriptionText, HelpText } from './form-help-text'
import type { ResolvedFormField } from './form-field-elements'

/**
 * The mark beside a required field's label. `aria-hidden` because the control
 * itself carries `aria-required`, so a screen reader already announces it; the
 * leading space keeps the mark off the last word of the label. The inline
 * runtime adds and removes the same span when a `requiredWhen` rule flips.
 */
export function RequiredMark({ required }: { readonly required: boolean }) {
  if (!required) return undefined
  return (
    <span
      className={computeFormRequiredMarkClasses()}
      data-required-mark="true"
      aria-hidden="true"
    >
      {' *'}
    </span>
  )
}

/** Classes of a filled and of a hollow glyph, the pair the runtime repaints with. */
const RATING_GLYPH_CLASS = {
  filled: `leading-none ${computeRatingGlyphClasses({ filled: true })}`,
  hollow: `leading-none ${computeRatingGlyphClasses({ filled: false })}`,
} as const

/** A rank's classes: the ring its transparent radio cannot draw on keyboard focus. */
const RATING_RANK_CLASS = computeRatingRankClasses()

/** One rank of the scale: a native radio laid over its glyph, named "n of max". */
function RatingRank(props: {
  readonly field: ResolvedFormField
  readonly rank: number
  readonly ranks: number
  readonly current: number
  readonly glyphs: readonly [string, string]
}) {
  const { field, rank, ranks, current, glyphs } = props
  const filled = rank <= current
  return (
    <label className={RATING_RANK_CLASS}>
      <input
        type="radio"
        name={field.name}
        value={String(rank)}
        aria-label={`${rank} of ${ranks}`}
        required={field.required}
        disabled={field.conditionHidden}
        defaultChecked={rank === current}
        className="absolute inset-0 m-0 cursor-pointer opacity-0"
      />
      <span
        aria-hidden="true"
        data-rating-glyph="true"
        data-filled={filled ? 'true' : 'false'}
        className={filled ? RATING_GLYPH_CLASS.filled : RATING_GLYPH_CLASS.hollow}
      >
        {filled ? glyphs[0] : glyphs[1]}
      </span>
    </label>
  )
}

/**
 * A `rating` column as a radio group of one choice per rank up to its `max`.
 * An unanswered group sends nothing — a browser posts no unchecked radio — so
 * the column stores NULL, never 0, which its `CHECK (col >= 1)` would refuse.
 */
export function RatingInput({
  field,
  defaultValue,
}: {
  readonly field: ResolvedFormField
  readonly defaultValue: string | undefined
}) {
  const ranks = field.column?.max ?? DEFAULT_RATING_MAX
  const glyphs = ratingGlyphsFor(field.column?.ratingStyle)
  const score = Number(defaultValue)
  const current = Number.isFinite(score) ? score : 0
  const legendId = `field-${field.name}-legend`
  return (
    <div
      className={`form-field form-field-rating ${computeFormFieldClasses()}`}
      {...fieldWrapperAttributes(field)}
    >
      <div
        id={legendId}
        className={`form-field-legend ${FIELD_LABEL_CLASS}`}
      >
        {field.label}
        <RequiredMark required={field.required} />
      </div>
      <span
        role="radiogroup"
        aria-labelledby={legendId}
        {...ariaRequired(field.required)}
        data-rating-scale="true"
        data-rating-glyphs={`${glyphs[0]}${glyphs[1]}`}
        data-rating-filled-class={RATING_GLYPH_CLASS.filled}
        data-rating-hollow-class={RATING_GLYPH_CLASS.hollow}
        className={`${computeRatingRowClasses()} w-fit`}
      >
        {Array.from({ length: ranks }, (_unused, index) => (
          <RatingRank
            key={index + 1}
            field={field}
            rank={index + 1}
            ranks={ranks}
            current={current}
            glyphs={glyphs}
          />
        ))}
      </span>
      <HelpText html={field.helpTextHtml} />
    </div>
  )
}

/**
 * A `kind: section` entry: its heading and its description, where it was
 * declared. It holds no control, so it adds nothing to what the form sends.
 * The form title is the page's `h1`, so a section is an `h2` — or an `h3`
 * inside a multi-step form, whose step title already takes the `h2`.
 */
export function SectionHeading({ field }: { readonly field: ResolvedFormField }) {
  const Heading = field.sectionLevel === 3 ? 'h3' : 'h2'
  return (
    <div
      className="form-section"
      {...fieldWrapperAttributes(field)}
    >
      {field.label !== '' && (
        <Heading className={`form-section-heading ${computeFormGroupLabelClasses()}`}>
          {field.label}
        </Heading>
      )}
      <DescriptionText
        html={field.helpTextHtml ?? ''}
        className={`form-section-description ${computeFormHelpTextClasses()}`}
      />
    </div>
  )
}
