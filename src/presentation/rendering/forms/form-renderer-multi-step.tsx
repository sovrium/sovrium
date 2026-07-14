/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { FormFieldElement, type PrefillValue } from './form-field-elements'
import type { resolveAllFields } from './form-field-resolver'
import type { Form } from '@/domain/models/app/forms'

export interface FormBodyShared {
  readonly title: string
  readonly description: string
  readonly submitLabel: string
  readonly formAttributes: Readonly<Record<string, string>>
  readonly resolvedFields: ReturnType<typeof resolveAllFields>
  readonly prefillMap: Readonly<Record<string, PrefillValue>>
  readonly lockPrefill: boolean
  readonly titleAs?: 'h1' | 'h2' | 'h3'
  readonly fieldGroups?: NonNullable<Form['fieldGroups']>
  readonly antiSpamHoneypot?: boolean
}

function FormStepProgress({ totalVisible }: { readonly totalVisible: number }) {
  return (
    <div
      className="form-progress"
      data-form-progress="true"
      role="status"
      aria-label="Step progress"
    >
      {`Step 1 of ${totalVisible}`}
    </div>
  )
}

function FormStepNav({ isFirst, isLast }: { readonly isFirst: boolean; readonly isLast: boolean }) {
  return (
    <div className="form-step-nav">
      {!isFirst && (
        <button
          type="button"
          className="step-previous"
        >
          Previous
        </button>
      )}
      {!isLast && (
        <button
          type="button"
          className="step-next"
        >
          Next
        </button>
      )}
    </div>
  )
}

export function FormBodyStep({
  step,
  stepIndex,
  isFirst,
  isLast,
  stepFields,
  prefillMap,
  lockPrefill,
}: {
  readonly step: NonNullable<Form['steps']>[number]
  readonly stepIndex: number
  readonly isFirst: boolean
  readonly isLast: boolean
  readonly stepFields: ReturnType<typeof resolveAllFields>
  readonly prefillMap: Readonly<Record<string, PrefillValue>>
  readonly lockPrefill: boolean
}) {
  return (
    <div
      className="form-step"
      data-step={step.id}
      data-step-index={stepIndex}
      data-step-active="true"
    >
      {step.title && <h2 className="step-title">{step.title}</h2>}
      {step.description && <p className="step-description">{step.description}</p>}
      {stepFields.map((field) => (
        <FormFieldElement
          key={field.name}
          field={field}
          prefillValue={prefillMap[field.name]}
          lockPrefill={lockPrefill}
        />
      ))}
      <FormStepNav
        isFirst={isFirst}
        isLast={isLast}
      />
    </div>
  )
}

interface MultiStepFormProps extends FormBodyShared {
  readonly activeStep: NonNullable<Form['steps']>[number]
  readonly isLast: boolean
}

function MultiStepFormElement({
  submitLabel,
  formAttributes,
  resolvedFields,
  prefillMap,
  lockPrefill,
  activeStep,
  isLast,
}: MultiStepFormProps) {
  return (
    <form
      {...formAttributes}
      data-layout="multi-step"
      data-active-step={activeStep.id}
    >
      <FormBodyStep
        step={activeStep}
        stepIndex={0}
        isFirst={true}
        isLast={isLast}
        stepFields={resolvedFields.filter((f) => activeStep.fields.includes(f.name))}
        prefillMap={prefillMap}
        lockPrefill={lockPrefill}
      />
      {}
      <button
        type="submit"
        {...(isLast ? {} : { hidden: true })}
      >
        {submitLabel}
      </button>
    </form>
  )
}

export function FormBodyMultiStep(
  props: FormBodyShared & { readonly steps: NonNullable<Form['steps']> }
) {
  const { title, description, steps, titleAs = 'h1' } = props
  const TitleTag = titleAs
  const activeStep = steps[0]
  if (activeStep === undefined) {
    return (
      <>
        <TitleTag className="form-title">{title}</TitleTag>
        {description && <p className="form-description">{description}</p>}
      </>
    )
  }
  return (
    <>
      <TitleTag className="form-title">{title}</TitleTag>
      {description && <p className="form-description">{description}</p>}
      <FormStepProgress totalVisible={steps.length} />
      <MultiStepFormElement
        {...props}
        activeStep={activeStep}
        isLast={steps.length === 1}
      />
    </>
  )
}
