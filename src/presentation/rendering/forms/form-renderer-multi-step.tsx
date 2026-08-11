/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Multi-step form body rendering, sliced out of `form-renderer.tsx`.
 *
 * The initial GET `/forms/:name` lands on step 1. Only that step's fields
 * appear in the SSR HTML — the renderer does NOT inline the remaining steps'
 * inputs. Subsequent steps are fetched on demand by the
 * inline runtime via `GET /api/forms/:name/steps/:stepId`.
 *
 * `FormBodyStep` is exported because the step-fragment renderer in
 * `form-renderer.tsx` reuses it to serialise a single step on demand.
 */

import { FormFieldElement, type PrefillValue } from './form-field-elements'
import type { resolveAllFields } from './form-field-resolver'
import type { Form } from '@/domain/models/app/forms'

/**
 * Shared layout props for a form body. Re-declared here (rather than imported
 * from `form-renderer.tsx`) to avoid a circular module dependency.
 */
export interface FormBodyShared {
  readonly title: string
  readonly description: string
  readonly submitLabel: string
  readonly formAttributes: Readonly<Record<string, string>>
  readonly resolvedFields: ReturnType<typeof resolveAllFields>
  readonly prefillMap: Readonly<Record<string, PrefillValue>>
  readonly lockPrefill: boolean
  /**
   * P8: heading tag for the `form-title` element (`<h1|h2|h3>`). Defaults to
   * `'h1'`; an embedded formRef can opt into `'h2'`/`'h3'` via
   * `props.headingLevel` so it doesn't create a second page <h1>. All three
   * body layouts (flat / multi-step / one-question) honor it.
   */
  readonly titleAs?: 'h1' | 'h2' | 'h3'
  /**
   * Single-page section dividers. Only consumed by the flat layout; the
   * multi-step and one-question bodies ignore it. Each visible group renders
   * a labeled header above its fields in declaration order.
   */
  readonly fieldGroups?: NonNullable<Form['fieldGroups']>
  /**
   * [internal ref]: when true, the form body renders a hidden honeypot
   * input (`_hp`) inside the `<form>` element. The server-side
   * `submit-form-honeypot.ts` rejects submissions whose `_hp` is non-empty.
   */
  readonly antiSpamHoneypot?: boolean
  /**
   * Whether this body is rendered EMBEDDED inside a host page / dialog (via
   * `renderEmbeddedFormBody`) rather than as the standalone `.form-page` shell.
   * The flat layout uses it to (1) give the title→description header a real
   * positive gap (the standalone shell's `.form-page`-scoped `-mt-3` does not
   * reach an embedded body) and (2) end-align the submit button (bottom-right)
   * instead of the standalone left alignment. Defaults to `false` (standalone).
   */
  readonly embedded?: boolean
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
      {/* Submit button stays in markup but hidden until the submitter
          reaches the last step; runtime toggles visibility per step. */}
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
