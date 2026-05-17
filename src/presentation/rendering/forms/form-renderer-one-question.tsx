/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One-question-at-a-time body rendering.
 *
 * APP-FORMS-045..051: Typeform-style layout. The SSR HTML emits ALL
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

import { FormFieldElement, type PrefillValue, type ResolvedFormField } from './form-field-elements'

interface OneQuestionBodyProps {
  readonly title: string
  readonly description: string
  readonly formAttributes: Readonly<Record<string, string>>
  readonly resolvedFields: ReadonlyArray<ResolvedFormField>
  readonly prefillMap: Readonly<Record<string, PrefillValue>>
  readonly lockPrefill: boolean
}

function FormQuestionWrapper({
  field,
  index,
  prefillMap,
  lockPrefill,
}: {
  readonly field: ResolvedFormField
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
      <FormFieldElement
        field={field}
        prefillValue={prefillMap[field.name]}
        lockPrefill={lockPrefill}
      />
    </div>
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
}: {
  readonly resolvedFields: ReadonlyArray<ResolvedFormField>
}) {
  return (
    <section
      className="form-summary"
      data-form-summary="true"
      hidden={true}
      aria-label="Review your answers"
    >
      <h2>Review your answers</h2>
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
        className="form-summary-submit"
      >
        Submit
      </button>
    </section>
  )
}

/**
 * Rewrites `select` standalone fields to `radio` inside a one-question
 * layout so the runtime's per-option-label auto-advance UX (APP-FORMS-047)
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
}: {
  readonly formAttributes: Readonly<Record<string, string>>
  readonly transformedVisible: ReadonlyArray<ResolvedFormField>
  readonly hiddenFields: ReadonlyArray<ResolvedFormField>
  readonly prefillMap: Readonly<Record<string, PrefillValue>>
  readonly lockPrefill: boolean
}) {
  return (
    <form
      {...formAttributes}
      data-layout="one-question"
    >
      {transformedVisible.map((field, index) => (
        <FormQuestionWrapper
          key={field.name}
          field={field}
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
      <FormSummaryScreen resolvedFields={transformedVisible} />
    </form>
  )
}

export function FormBodyOneQuestion({
  title,
  description,
  formAttributes,
  resolvedFields,
  prefillMap,
  lockPrefill,
}: OneQuestionBodyProps) {
  // Filter out hidden fields from the question count — they render
  // server-side defaults at submission time and never count as a
  // "screen" in the Typeform flow.
  const visibleFields = resolvedFields.filter((f) => !f.hidden)
  const transformedVisible = rewriteSelectAsRadio(visibleFields)
  const totalQuestions = transformedVisible.length
  const hiddenFields = resolvedFields.filter((f) => f.hidden)
  return (
    <>
      <h1 className="form-title">{title}</h1>
      {description && <p className="form-description">{description}</p>}
      <FormProgressBar totalQuestions={totalQuestions} />
      <OneQuestionForm
        formAttributes={formAttributes}
        transformedVisible={transformedVisible}
        hiddenFields={hiddenFields}
        prefillMap={prefillMap}
        lockPrefill={lockPrefill}
      />
      <button
        type="button"
        className="form-previous"
        data-form-previous="true"
      >
        Previous
      </button>
    </>
  )
}
