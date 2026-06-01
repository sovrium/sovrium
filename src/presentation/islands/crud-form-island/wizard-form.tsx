/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'
import { type FieldDef } from '../components/crud-form/fields'
import { FormFields } from '../components/crud-form/layout'
import { findMissingRequiredFields, submitCrudForm } from './submit-pipeline'
import {
  type CrudFormIslandProps,
  type FormState,
  type SubmitContext,
  type WizardStep,
} from './types'

function resolveStepFields(island: CrudFormIslandProps, step: number): readonly FieldDef[] {
  const names = new Set(island.wizard![step]?.fields ?? [])
  return island.fields.filter((f) => names.has(f.name))
}

function WizardProgress(props: {
  readonly steps: readonly WizardStep[]
  readonly current: number
}) {
  const { steps, current } = props
  return (
    <ol data-wizard-progress>
      {steps.map((s, i) => (
        <li
          key={s.label}
          {...(i === current && { 'aria-current': 'step' })}
          data-wizard-step-label
        >
          {s.label}
        </li>
      ))}
    </ol>
  )
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
          className="btn btn-secondary"
          onClick={onBack}
        >
          Back
        </button>
      )}
      {isLastStep ? (
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isPending}
        >
          {isPending ? 'Saving...' : buttonLabel}
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-primary"
          onClick={onNext}
        >
          Next
        </button>
      )}
    </div>
  )
}

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
      aria-label={`Create ${island.table}`}
      onSubmit={onSubmit}
      data-action-type="crud"
      data-action-method="create"
      data-action-table={island.table}
      noValidate
    >
      <WizardProgress
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
