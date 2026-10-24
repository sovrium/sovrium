/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One-question-at-a-time body rendering.
 *
 * Typeform-style layout. The SSR HTML emits ALL
 * questions up front, each wrapped in a `<div class="form-question">`
 * with `data-question-index` and `hidden` (except question 0). The
 * inline runtime (form-runtime-one-question.ts) toggles visibility on
 * keyboard / click navigation, leaving the form values in the DOM the
 * whole time so Previous trivially preserves them.
 *
 * Why not server-mediated step nav (like the multi-step layout): the
 * Typeform UX targets sub-250ms transitions between questions; a server
 * round-trip per question would feel sluggish. And every question shares
 * one `<form>` element so the final summary submit captures every field
 * value with one POST.
 *
 * The renderer also rewrites `inputElement` from `'select'` to `'radio'`
 * for standalone fields with options. The one-question runtime is built
 * around per-option labels (`page.getByLabel('Engineer')`) and
 * auto-advance after a `change` event — a `<select>` dropdown does not
 * surface stable per-option labels, and the change-event timing on a
 * native select feels off compared to clickable radio cards.
 *
 * The progress bar lives OUTSIDE the form so the runtime can update it
 * without scoping queries through the form root. The Previous button
 * lives outside the form for the same reason. The summary screen sits
 * INSIDE the form so its `<button type="submit">` natively triggers the
 * form's submit event.
 *
 * Sliced out of `form-renderer.tsx` so the parent file stays under the
 * project's max-lines cap; mirrors the same pattern used by
 * `form-runtime-one-question.ts` for the inline runtime fragment.
 */

import {
  FormFieldElement,
  prefillValueToString,
  type PrefillValue,
  type ResolvedFormField,
} from './form-field-elements'
import { attachSectionsToNextField, type FieldWithSections } from './form-field-resolver'
import { DescriptionText } from './form-help-text'
import { IdempotencyKeyInput } from './form-idempotency-key'
import { DesignedRadioQuestion } from './form-one-question-radio'
import { RequiredLegend } from './form-required-legend'

interface OneQuestionBodyProps {
  readonly title: string
  /** The description as sanitized inline HTML (`renderInlineMarkdown`); `''` for none. */
  readonly descriptionHtml: string
  readonly formAttributes: Readonly<Record<string, string>>
  readonly resolvedFields: ReadonlyArray<ResolvedFormField>
  readonly prefillMap: Readonly<Record<string, PrefillValue>>
  readonly lockPrefill: boolean
  /** P8: heading tag for the form title. Defaults to `'h1'`. */
  readonly titleAs?: 'h1' | 'h2' | 'h3'
  /** Drawn inside a host page: the form's script mints its idempotency key. */
  readonly embedded?: boolean
  /** The legend explaining the asterisk, in the page language. */
  readonly requiredLegend?: string
  /** The summary screen's heading, in the page language. */
  readonly reviewAnswersLabel?: string
}

function FormQuestionWrapper({
  field,
  sections,
  index,
  prefillMap,
  lockPrefill,
}: {
  readonly field: ResolvedFormField
  /** The sections declared just before this question, drawn on its screen. */
  readonly sections: ReadonlyArray<ResolvedFormField>
  readonly index: number
  readonly prefillMap: Readonly<Record<string, PrefillValue>>
  readonly lockPrefill: boolean
}) {
  const isFirst = index === 0
  return (
    <div
      className="form-question"
      data-question-index={String(index)}
      {...(isFirst ? { 'data-question-active': 'true' } : { hidden: true })}
    >
      {sections.map((section) => (
        <FormFieldElement
          key={section.name}
          field={section}
          prefillValue={undefined}
          lockPrefill={false}
        />
      ))}
      <QuestionControl
        field={field}
        prefillValue={prefillMap[field.name]}
        lockPrefill={lockPrefill}
      />
    </div>
  )
}

/**
 * A question's control: a choice as the design system's radio group, every
 * other control as the form draws it everywhere. A choice whose prefill is
 * locked stays the hidden input that carries it.
 */
function QuestionControl({
  field,
  prefillValue,
  lockPrefill,
}: {
  readonly field: ResolvedFormField
  readonly prefillValue: PrefillValue | undefined
  readonly lockPrefill: boolean
}) {
  const locked = lockPrefill && field.prefillEditable !== true && prefillValue !== undefined
  if (field.inputElement !== 'radio' || field.hidden || locked) {
    return (
      <FormFieldElement
        field={field}
        prefillValue={prefillValue}
        lockPrefill={lockPrefill}
      />
    )
  }
  return (
    <DesignedRadioQuestion
      field={field}
      defaultValue={prefillValue === undefined ? undefined : prefillValueToString(prefillValue)}
    />
  )
}

function FormProgressBar({ totalQuestions }: { readonly totalQuestions: number }) {
  return (
    <div
      className="form-progress-bar"
      data-form-progress-bar="true"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
      aria-label={`Progress: 0 of ${totalQuestions}`}
    />
  )
}

function FormSummaryScreen({
  resolvedFields,
  heading,
}: {
  readonly resolvedFields: ReadonlyArray<ResolvedFormField>
  readonly heading: string
}) {
  return (
    <section
      className="form-summary"
      data-form-summary="true"
      hidden={true}
      aria-label={heading}
    >
      <h2>{heading}</h2>
      <dl>
        {resolvedFields.map((field) => (
          <div
            key={field.name}
            className="form-summary-row"
          >
            <dt>{field.label}</dt>
            <dd data-summary-for={field.name} />
          </div>
        ))}
      </dl>
      <button
        type="submit"
        data-component-type="button"
        className="form-summary-submit"
      >
        Submit
      </button>
    </section>
  )
}

/**
 * Rewrites `select` standalone fields to `radio` inside a one-question
 * layout so the runtime's per-option-label auto-advance UX
 * works (a `<select>` dropdown does not surface stable per-option labels).
 *
 * `htmlInputType` is left untouched — `RadioInput` hardcodes
 * `<input type="radio">` and never reads `htmlInputType` for the radio
 * variant. Preserving the original value reduces the surface area for
 * future bugs if a richer renderer ever consumes `htmlInputType` on radio.
 */
function rewriteSelectAsRadio(
  fields: ReadonlyArray<ResolvedFormField>
): ReadonlyArray<ResolvedFormField> {
  return fields.map((field) =>
    field.inputElement === 'select' && field.options !== undefined && field.options.length > 0
      ? { ...field, inputElement: 'radio' }
      : field
  )
}

function OneQuestionForm({
  formAttributes,
  transformedVisible,
  hiddenFields,
  prefillMap,
  lockPrefill,
  embedded,
  requiredLegend,
  reviewAnswersLabel = 'Review your answers',
}: {
  readonly formAttributes: Readonly<Record<string, string>>
  readonly transformedVisible: ReadonlyArray<FieldWithSections>
  readonly hiddenFields: ReadonlyArray<ResolvedFormField>
  readonly prefillMap: Readonly<Record<string, PrefillValue>>
  readonly lockPrefill: boolean
  readonly embedded: boolean | undefined
  readonly requiredLegend: string | undefined
  readonly reviewAnswersLabel: string | undefined
}) {
  return (
    <form
      {...formAttributes}
      data-layout="one-question"
    >
      <IdempotencyKeyInput embedded={embedded} />
      <RequiredLegend
        text={requiredLegend}
        fields={transformedVisible.map((group) => group.field)}
      />
      {transformedVisible.map(({ field, sections }, index) => (
        <FormQuestionWrapper
          key={field.name}
          field={field}
          sections={sections}
          index={index}
          prefillMap={prefillMap}
          lockPrefill={lockPrefill}
        />
      ))}
      {/* Hidden fields render after the questions so their server-side
          defaults still feed into the body on submit. */}
      {hiddenFields.map((field) => (
        <FormFieldElement
          key={field.name}
          field={field}
          prefillValue={prefillMap[field.name]}
          lockPrefill={lockPrefill}
        />
      ))}
      {/* Summary screen is rendered INSIDE the form so the Submit
          button natively triggers the form's submit event (which the
          one-question runtime intercepts via a synchronous XHR). */}
      <FormSummaryScreen
        resolvedFields={transformedVisible.map((group) => group.field)}
        heading={reviewAnswersLabel}
      />
    </form>
  )
}

export function FormBodyOneQuestion({
  title,
  descriptionHtml,
  formAttributes,
  resolvedFields,
  prefillMap,
  lockPrefill,
  titleAs = 'h1',
  embedded,
  requiredLegend,
  reviewAnswersLabel,
}: OneQuestionBodyProps) {
  const TitleTag = titleAs
  // Filter out hidden fields from the question count — they render
  // server-side defaults at submission time and never count as a
  // "screen" in the Typeform flow.
  const visibleFields = resolvedFields.filter((f) => !f.hidden)
  // A section is not a question: it is drawn on the screen of the question
  // declared after it, and counts neither as a screen nor in the summary.
  const transformedVisible = attachSectionsToNextField(rewriteSelectAsRadio(visibleFields))
  const totalQuestions = transformedVisible.length
  const hiddenFields = resolvedFields.filter((f) => f.hidden)
  return (
    <>
      {title !== '' && <TitleTag className="form-title">{title}</TitleTag>}
      <DescriptionText
        html={descriptionHtml}
        className="form-description"
      />
      <FormProgressBar totalQuestions={totalQuestions} />
      <OneQuestionForm
        formAttributes={formAttributes}
        transformedVisible={transformedVisible}
        hiddenFields={hiddenFields}
        prefillMap={prefillMap}
        lockPrefill={lockPrefill}
        embedded={embedded}
        requiredLegend={requiredLegend}
        reviewAnswersLabel={reviewAnswersLabel}
      />
      <button
        type="button"
        data-component-type="button"
        className="form-previous"
        data-form-previous="true"
      >
        Previous
      </button>
    </>
  )
}
