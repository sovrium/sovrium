/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { computeFormLayoutClasses } from '@/presentation/design/form-layout-classes'
import { StepRail } from '@/presentation/design/step-rail'
import { type FieldDef } from '../parts/crud-form/fields'
import { FormFields } from '../parts/crud-form/layout'
import { findMissingRequiredFields, submitCrudForm } from './submit-pipeline'
import { type CrudFormIslandProps, type FormState, type SubmitContext } from './types'

function resolveStepFields(island: CrudFormIslandProps, step: number): readonly FieldDef[] {
  const names = new Set(island.wizard![step]?.fields ?? [])
  return island.fields.filter((f) => names.has(f.name))
}

function WizardNav(props: {
  readonly step: number
  readonly isLastStep: boolean
  readonly isPending: boolean
  readonly buttonLabel: string
  readonly onBack: () => void
  readonly onNext: () => void
}) {
  const { step, isLastStep, isPending, buttonLabel, onBack, onNext } = props
  return (
    <div>
      {step > 0 && (
        <button
          type="button"
          className={computeButtonDefaultClasses({ variant: 'secondary' })}
          onClick={onBack}
        >
          Back
        </button>
      )}
      {isLastStep ? (
        <button
          type="submit"
          className={computeButtonDefaultClasses()}
          disabled={isPending}
        >
          {isPending ? 'Saving...' : buttonLabel}
        </button>
      ) : (
        <button
          type="button"
          className={computeButtonDefaultClasses()}
          onClick={onNext}
        >
          Next
        </button>
      )}
    </div>
  )
}

/**
 * Wizard step-navigation handlers.
 *
 * `onNext` validates the current step's required fields before advancing —
 * a step with a missing required field blocks advancement and surfaces an
 * inline field error. `onBack` clears any pending field error so the prior
 * step renders clean. `onSubmit` only triggers a create on the final step.
 */
function useWizardNavigation(args: {
  readonly stepFields: readonly FieldDef[]
  readonly values: Record<string, string>
  readonly isLastStep: boolean
  readonly ctx: SubmitContext
  readonly setStep: React.Dispatch<React.SetStateAction<number>>
}) {
  const { stepFields, values, isLastStep, ctx, setStep } = args

  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      // On a `resetOnSuccess` wizard, afterReset returns to step 1.
      if (isLastStep) void submitCrudForm({ ...ctx, afterReset: () => setStep(0) })
    },
    [isLastStep, ctx, setStep]
  )

  const onBack = useCallback(() => {
    ctx.setState({ isPending: false })
    setStep((s) => s - 1)
  }, [ctx, setStep])

  const onNext = useCallback(() => {
    const missing = findMissingRequiredFields(stepFields, values)
    if (missing.length > 0) {
      ctx.setState({
        fieldError: { field: missing[0]!, message: 'This field is required' },
        invalidFields: missing,
        isPending: false,
      })
      return
    }
    ctx.setState({ isPending: false })
    setStep((s) => s + 1)
  }, [stepFields, values, ctx, setStep])

  return { onSubmit, onBack, onNext }
}

/**
 * Multi-step wizard form for create operations.
 *
 * Renders only the fields assigned to the current step. `visibleWhen`
 * conditions that reference fields from other steps still evaluate correctly
 * because all step values are tracked in a single shared state object.
 */
export function WizardCreateForm(props: {
  readonly island: CrudFormIslandProps
  readonly values: Record<string, string>
  readonly state: FormState
  readonly ctx: SubmitContext
  readonly onFieldChange: (name: string, value: string) => void
}) {
  const [step, setStep] = useState(0)
  const { island, values, state, ctx, onFieldChange } = props
  const isLastStep = step === island.wizard!.length - 1
  const stepFields = resolveStepFields(island, step)
  const { onSubmit, onBack, onNext } = useWizardNavigation({
    stepFields,
    values,
    isLastStep,
    ctx,
    setStep,
  })

  return (
    <form
      className={computeFormLayoutClasses()}
      aria-label={`Create ${island.table}`}
      onSubmit={onSubmit}
      data-action-type="crud"
      data-action-method="create"
      data-action-table={island.table}
      noValidate
    >
      <StepRail
        steps={island.wizard!}
        current={step}
      />
      <FormFields
        fields={stepFields}
        values={values}
        onChange={onFieldChange}
        fieldError={state.fieldError}
        invalidFields={state.invalidFields}
      />
      {state.error && <div role="alert">{state.error}</div>}
      <WizardNav
        step={step}
        isLastStep={isLastStep}
        isPending={state.isPending ?? false}
        buttonLabel={island.buttonLabel ?? 'Create'}
        onBack={onBack}
        onNext={onNext}
      />
    </form>
  )
}
