/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useMemo } from 'react'
import { computeFormLayoutClasses } from '@/presentation/design/form-layout-classes'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { type FieldDef } from '../parts/crud-form/fields'
import { FormBody } from '../parts/crud-form/layout'
import { type SaveBarState } from '../parts/crud-form/save-bar'
import { SideLabelsContext } from '../parts/crud-form/side-labels-context'
import { postHeldValues } from '../parts/crud-form/wire-values'
import { formString } from './form-strings'
import { blockingFieldState, submitCrudForm } from './submit-pipeline'
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
      const blocking = blockingFieldState(fields, values, ctx.uiStrings)
      if (blocking !== undefined) {
        e.preventDefault()
        ctx.setState(blocking)
        return
      }
      // The browser builds the posted data after this handler returns.
      e.currentTarget.addEventListener(
        'formdata',
        (event) => postHeldValues((event as FormDataEvent).formData, fields, values),
        { once: true }
      )
    }
  }
  return (e) => {
    e.preventDefault()
    void submitCrudForm(ctx)
  }
}

/** Default submit-button label for a given CRUD operation, in the page language. */
function defaultSubmitLabelFor(
  operation: string,
  strings: CrudFormIslandProps['uiStrings']
): string {
  if (operation === 'automation') return formString(strings, 'form.submit', 'Submit')
  return formString(strings, 'form.update', 'Update')
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
 * Renders the `<form>` element + body for an update CRUD form. Split out
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
  readonly saveBar?: SaveBarState
}) {
  const { island, values, state, ctx, onFieldChange, autoSave, useNativeForm } = props
  const { operation, table, fields, className, layout } = island
  const formAction = useNativeForm ? buildNativeFormAction(table, island.recordId!) : undefined
  const submitLabel = island.buttonLabel ?? defaultSubmitLabelFor(operation, island.uiStrings)
  const onSubmit = buildSubmitHandler(useNativeForm, fields, values, ctx)
  // A button field runs against the edited row. Memoized so the field subtree does not re-render on every keystroke.
  const binding = useMemo(
    () => ({ table, ...(island.recordId === undefined ? {} : { recordId: island.recordId }) }),
    [table, island.recordId]
  )

  return (
    <form
      ref={autoSave.formRef}
      aria-label={`Edit ${table}`}
      method={useNativeForm ? 'POST' : undefined}
      action={formAction}
      onSubmit={onSubmit}
      className={resolveClasses(computeFormLayoutClasses(), className)}
      id={island.id}
      data-testid={island['data-testid']}
      data-action-type="crud"
      data-action-method={operation}
      data-action-table={table}
      {...(autoSave.enabled && { 'data-auto-save': island.autoSave?.saveMode })}
      {...(layout && { 'data-layout': layout })}
      noValidate
    >
      <SideLabelsContext value={island.labelPlacement === 'side'}>
        <FormBody
          fields={fields}
          values={values}
          state={state}
          onFieldChange={onFieldChange}
          redirectUrl={island.redirectUrl}
          useNativeForm={useNativeForm}
          submitLabel={submitLabel}
          savingLabel={formString(island.uiStrings, 'form.saving', 'Saving...')}
          variant={island.variant}
          layout={layout}
          {...(island.aside === undefined ? {} : { aside: island.aside })}
          binding={binding}
          {...(island.sections === undefined ? {} : { sections: island.sections })}
          {...(props.saveBar === undefined ? {} : { saveBar: props.saveBar })}
          uiStrings={island.uiStrings}
        />
      </SideLabelsContext>
    </form>
  )
}

export function CreateUpdateForm(props: {
  readonly island: CrudFormIslandProps
  readonly values: Record<string, string>
  readonly state: FormState
  readonly ctx: SubmitContext
  readonly onFieldChange: (name: string, value: string) => void
  /** Fields changed since the form was filled — set only under `stickyActions`. */
  readonly changes?: number
  readonly onDiscard: () => void
}) {
  const { island, values, state, ctx, onFieldChange } = props
  const { operation, fields } = island
  const autoSave = useAutoSave({ island, values, ctx, setState: ctx.setState })
  // When auto-save is active the form persists edits in-place; the native
  // POST/redirect path would conflict (full page reload on submit), so it is
  // disabled and submission falls back to the JS mutation handler. A host that
  // must not be navigated away from (`submitInPlace`) takes the same path, and
  // so does a form that announces its save with a toast AND moves on
  // (`navigate`): the native post would land on the next page with the toast
  // never shown, where the script shows it and then navigates.
  const useNativeForm =
    operation === 'update' &&
    !!island.recordId &&
    !autoSave.enabled &&
    !island.submitInPlace &&
    !(island.successToast?.message !== undefined && island.redirectUrl !== undefined)

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
      {...(props.changes === undefined
        ? {}
        : { saveBar: { changes: props.changes, onDiscard: props.onDiscard } })}
    />
  )
}
