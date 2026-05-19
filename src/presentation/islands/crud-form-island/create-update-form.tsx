/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type FieldDef } from '../components/crud-form/fields'
import { FormBody } from '../components/crud-form/layout'
import { findMissingRequiredFields, submitCrudForm } from './submit-pipeline'
import { type CrudFormIslandProps, type FormState, type SubmitContext } from './types'

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

export function CreateUpdateForm(props: {
  readonly island: CrudFormIslandProps
  readonly values: Record<string, string>
  readonly state: FormState
  readonly ctx: SubmitContext
  readonly onFieldChange: (name: string, value: string) => void
}) {
  const { island, values, state, ctx, onFieldChange } = props
  const { operation, table, fields, className, layout, fieldGroups } = island
  const useNativeForm = operation === 'update' && !!island.recordId
  const formAction = useNativeForm ? buildNativeFormAction(table, island.recordId!) : undefined
  const defaultSubmitLabel =
    operation === 'create' ? 'Create' : operation === 'automation' ? 'Submit' : 'Update'
  const submitLabel = island.buttonLabel ?? defaultSubmitLabel
  const onSubmit = buildSubmitHandler(useNativeForm, fields, values, ctx)

  return (
    <form
      aria-label={operation === 'create' ? `Create ${table}` : `Edit ${table}`}
      method={useNativeForm ? 'POST' : undefined}
      action={formAction}
      onSubmit={onSubmit}
      className={className}
      id={island.id}
      data-testid={island['data-testid']}
      data-action-type="crud"
      data-action-method={operation}
      data-action-table={table}
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
      />
    </form>
  )
}
