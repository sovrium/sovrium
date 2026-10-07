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
import { stepItems, type resolveAllFields } from './form-field-resolver'
import { DescriptionText } from './form-help-text'
import type { FormLayoutKeys } from './form-layout-keys'
import type { SaveForLaterLabels } from './form-save-for-later-labels'
import type { Form } from '@/domain/models/app/forms'

/**
 * Shared layout props for a form body. Re-declared here (rather than imported
 * from `form-renderer.tsx`) to avoid a circular module dependency.
 */
export interface FormBodyShared {
  /** "Save and continue later" beside the submit, worded; absent when not offered. */
  readonly saveForLater?: SaveForLaterLabels
  /** The form title; `''` when the host draws its own heading (a dialog) — then no title is drawn. */
  readonly title: string
  /** The form description as sanitized inline HTML (`renderInlineMarkdown`); `''` for none. */
  readonly descriptionHtml: string
  /**
   * Each step's description, translated then rendered as sanitized inline
   * HTML, keyed by step id. A step missing from it shows no description.
   */
  readonly stepDescriptionsHtml?: Readonly<Record<string, string>>
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
  /** The page form's layout keys on a hosted form: labels beside controls, a sticky submit bar. */
  readonly layoutKeys?: FormLayoutKeys
  /**
   * When true, the form body renders a hidden honeypot
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
  /**
   * The label of a Cancel drawn beside the submit, already translated. Set by
   * a dialog hosting the form (`expandDialogFormRef`): the button carries
   * `data-dialog-cancel` and the dialog island closes on it. Absent, the form
   * offers its submit alone.
   */
  readonly cancelLabel?: string
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
          data-component-type="button"
          className="step-previous"
        >
          Previous
        </button>
      )}
      {!isLast && (
        <button
          type="button"
          data-component-type="button"
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
  descriptionHtml,
}: {
  readonly step: NonNullable<Form['steps']>[number]
  readonly stepIndex: number
  readonly isFirst: boolean
  readonly isLast: boolean
  readonly stepFields: ReturnType<typeof resolveAllFields>
  readonly prefillMap: Readonly<Record<string, PrefillValue>>
  readonly lockPrefill: boolean
  /** The step description, translated and rendered (`renderInlineMarkdown`); `''` for none. */
  readonly descriptionHtml: string
}) {
  return (
    <div
      className="form-step"
      data-step={step.id}
      data-step-index={stepIndex}
      data-step-active="true"
    >
      {step.title && <h2 className="step-title">{step.title}</h2>}
      <DescriptionText
        html={descriptionHtml}
        className="step-description"
      />
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
  stepDescriptionsHtml,
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
        stepFields={stepItems(resolvedFields, activeStep.fields)}
        prefillMap={prefillMap}
        lockPrefill={lockPrefill}
        descriptionHtml={stepDescriptionsHtml?.[activeStep.id] ?? ''}
      />
      {/* Submit button stays in markup but hidden until the submitter
          reaches the last step; runtime toggles visibility per step. */}
      <button
        type="submit"
        data-component-type="button"
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
  const { title, descriptionHtml, steps, titleAs = 'h1' } = props
  const TitleTag = titleAs
  const activeStep = steps[0]
  if (activeStep === undefined) {
    return (
      <>
        {title !== '' && <TitleTag className="form-title">{title}</TitleTag>}
        <DescriptionText
          html={descriptionHtml}
          className="form-description"
        />
      </>
    )
  }
  return (
    <>
      {title !== '' && <TitleTag className="form-title">{title}</TitleTag>}
      <DescriptionText
        html={descriptionHtml}
        className="form-description"
      />
      <FormStepProgress totalVisible={steps.length} />
      <MultiStepFormElement
        {...props}
        activeStep={activeStep}
        isLast={steps.length === 1}
      />
    </>
  )
}
