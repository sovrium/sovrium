/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { FormFieldElement, type PrefillValue, type ResolvedFormField } from './form-field-elements'

interface OneQuestionBodyProps {
  readonly title: string
  readonly description: string
  readonly formAttributes: Readonly<Record<string, string>>
  readonly resolvedFields: ReadonlyArray<ResolvedFormField>
  readonly prefillMap: Readonly<Record<string, PrefillValue>>
  readonly lockPrefill: boolean
  readonly titleAs?: 'h1' | 'h2' | 'h3'
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
      {}
      {hiddenFields.map((field) => (
        <FormFieldElement
          key={field.name}
          field={field}
          prefillValue={prefillMap[field.name]}
          lockPrefill={lockPrefill}
        />
      ))}
      {}
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
  titleAs = 'h1',
}: OneQuestionBodyProps) {
  const TitleTag = titleAs
  const visibleFields = resolvedFields.filter((f) => !f.hidden)
  const transformedVisible = rewriteSelectAsRadio(visibleFields)
  const totalQuestions = transformedVisible.length
  const hiddenFields = resolvedFields.filter((f) => f.hidden)
  return (
    <>
      <TitleTag className="form-title">{title}</TitleTag>
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
