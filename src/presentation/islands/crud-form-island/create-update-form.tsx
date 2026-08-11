/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useMemo } from 'react'
import { cn } from '@/presentation/utils/design/class-merge'
import { computeFormLayoutClasses } from '@/presentation/utils/design/form-layout-classes'
import { type FieldDef } from '../components/crud-form/fields'
import { FormBody } from '../components/crud-form/layout'
import { findMissingRequiredFields, submitCrudForm } from './submit-pipeline'
import { SuccessPage } from './success-page'
import { type CrudFormIslandProps, type FormState, type SubmitContext } from './types'
import { useAutoSave } from './use-auto-save'

function buildNativeFormAction(table: string, recordId: string): string {
  return `/api/tables/${encodeURIComponent(table)}/records/${encodeURIComponent(recordId)}/update`
}

function buildSubmitHandler(
  useNativeForm: boolean,
  fields: readonly FieldDef[],
  values: Record<string, string>,
  ctx: SubmitContext
): React.FormEventHandler<HTMLFormElement> {
  if (useNativeForm) {
    return (e) => {
      const missing = findMissingRequiredFields(fields, values)
      if (missing.length > 0) {
        e.preventDefault()
        ctx.setState({
          fieldError: { field: missing[0]!, message: 'This field is required' },
          invalidFields: missing,
          isPending: false,
        })
      }
    }
  }
  return (e) => {
    e.preventDefault()
    void submitCrudForm(ctx)
  }
}

/** Default submit-button label for a given CRUD operation. */
function defaultSubmitLabelFor(operation: string): string {
  if (operation === 'create') return 'Create'
  if (operation === 'automation') return 'Submit'
  return 'Update'
}

/**
 * Renders the post-submit success page for an `onSuccess.type: 'successPage'`
 * form. Owns the `reset` callback that returns the form to its empty state.
 */
function CrudSuccessPage(props: {
  readonly island: CrudFormIslandProps
  readonly fields: readonly FieldDef[]
  readonly ctx: SubmitContext
  readonly submittedValues: Record<string, string>
}) {
  const { island, fields, ctx, submittedValues } = props
  const onReset = useCallback(() => {
    ctx.resetValues()
    ctx.setState({ isPending: false })
  }, [ctx])
  return (
    <SuccessPage
      config={island.successPage!}
      fields={fields}
      submittedValues={submittedValues}
      onReset={onReset}
      className={island.className}
      id={island.id}
      testId={island['data-testid']}
    />
  )
}

/**
 * Renders the `<form>` element + body for a create/update CRUD form. Split out
 * of `CreateUpdateForm` so the latter stays within the size/complexity caps
 * once the auto-save and success-page branches are both present.
 */
function CrudFormElement(props: {
  readonly island: CrudFormIslandProps
  readonly values: Record<string, string>
  readonly state: FormState
  readonly ctx: SubmitContext
  readonly onFieldChange: (name: string, value: string) => void
  readonly autoSave: ReturnType<typeof useAutoSave>
  readonly useNativeForm: boolean
}) {
  const { island, values, state, ctx, onFieldChange, autoSave, useNativeForm } = props
  const { operation, table, fields, className, layout, fieldGroups } = island
  const formAction = useNativeForm ? buildNativeFormAction(table, island.recordId!) : undefined
  const submitLabel = island.buttonLabel ?? defaultSubmitLabelFor(operation)
  const onSubmit = buildSubmitHandler(useNativeForm, fields, values, ctx)
  // A button field runs against a row, so it is live only on an update form.
  // A create form has no record yet and the button renders disabled until one
  // exists. Memoized so the field subtree does not re-render on every keystroke.
  const binding = useMemo(
    () => ({ table, ...(island.recordId === undefined ? {} : { recordId: island.recordId }) }),
    [table, island.recordId]
  )

  return (
    <form
      ref={autoSave.formRef}
      aria-label={operation === 'create' ? `Create ${table}` : `Edit ${table}`}
      method={useNativeForm ? 'POST' : undefined}
      action={formAction}
      onSubmit={onSubmit}
      className={cn(computeFormLayoutClasses(), className)}
      id={island.id}
      data-testid={island['data-testid']}
      data-action-type="crud"
      data-action-method={operation}
      data-action-table={table}
      {...(autoSave.enabled && { 'data-auto-save': island.autoSave?.saveMode })}
      {...(layout && { 'data-layout': layout })}
      noValidate
    >
      <FormBody
        fields={fields}
        values={values}
        state={state}
        onFieldChange={onFieldChange}
        redirectUrl={island.redirectUrl}
        useNativeForm={useNativeForm}
        submitLabel={submitLabel}
        variant={island.variant}
        fieldGroups={fieldGroups}
        layout={layout}
        binding={binding}
      />
    </form>
  )
}

export function CreateUpdateForm(props: {
  readonly island: CrudFormIslandProps
  readonly values: Record<string, string>
  readonly state: FormState
  readonly ctx: SubmitContext
  readonly onFieldChange: (name: string, value: string) => void
}) {
  const { island, values, state, ctx, onFieldChange } = props
  const { operation, fields } = island
  const autoSave = useAutoSave({ island, values, ctx, setState: ctx.setState })
  // When auto-save is active the form persists edits in-place; the native
  // POST/redirect path would conflict (full page reload on submit), so it is
  // disabled and submission falls back to the JS mutation handler.
  const useNativeForm = operation === 'update' && !!island.recordId && !autoSave.enabled

  // onSuccess.type: 'successPage' — replace the form with the success page once
  // the submission has succeeded. A `reset` action returns to the empty form.
  if (state.successPageShown && island.successPage) {
    return (
      <CrudSuccessPage
        island={island}
        fields={fields}
        ctx={ctx}
        submittedValues={state.successPageShown.values}
      />
    )
  }

  return (
    <CrudFormElement
      island={island}
      values={values}
      state={state}
      ctx={ctx}
      onFieldChange={onFieldChange}
      autoSave={autoSave}
      useNativeForm={useNativeForm}
    />
  )
}
