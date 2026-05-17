/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'
import { type FieldDef } from '../components/crud-form/fields'
import { FormFields } from '../components/crud-form/layout'
import { submitCrudForm } from './submit-pipeline'
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
          onClick={onBack}
        >
          Back
        </button>
      )}
      {isLastStep ? (
        <button
          type="submit"
          disabled={isPending}
        >
          {isPending ? 'Saving...' : buttonLabel}
        </button>
      ) : (
        <button
          type="button"
          onClick={onNext}
        >
          Next
        </button>
      )}
    </div>
  )
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

  // eslint-disable-next-line no-restricted-syntax -- needed to satisfy react-perf/jsx-no-new-function-as-prop; React Compiler not yet enabled in Bun (see docs/infrastructure/ui/react.md)
  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (isLastStep) void submitCrudForm(ctx)
    },
    [isLastStep, ctx]
  )

  // eslint-disable-next-line no-restricted-syntax -- needed to satisfy react-perf/jsx-no-new-function-as-prop; React Compiler not yet enabled in Bun (see docs/infrastructure/ui/react.md)
  const onBack = useCallback(() => setStep((s) => s - 1), [])
  // eslint-disable-next-line no-restricted-syntax -- needed to satisfy react-perf/jsx-no-new-function-as-prop; React Compiler not yet enabled in Bun (see docs/infrastructure/ui/react.md)
  const onNext = useCallback(() => setStep((s) => s + 1), [])

  return (
    <form
      aria-label={`Create ${island.table}`}
      onSubmit={onSubmit}
      data-action-type="crud"
      data-action-method="create"
      data-action-table={island.table}
      noValidate
    >
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
