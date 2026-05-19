/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import { DeleteView } from '../components/crud-delete-view'
import { CreateUpdateForm } from './create-update-form'
import { useCrudFormState } from './state'
import { submitCrudForm } from './submit-pipeline'
import { type CrudFormIslandProps } from './types'
import { WizardCreateForm } from './wizard-form'

export default function CrudFormIsland(props: CrudFormIslandProps) {
  const { values, state, ctx, handleFieldChange } = useCrudFormState(props)

  const onDelete = useCallback(() => {
    void submitCrudForm(ctx)
  }, [ctx])

  if (props.operation === 'delete') {
    return (
      <DeleteView
        confirm={props.confirm}
        confirmMessage={props.confirmMessage}
        buttonLabel={props.buttonLabel}
        state={state}
        onSubmit={onDelete}
        table={props.table}
        recordId={props.recordId}
        redirectUrl={props.redirectUrl}
        className={props.className}
        id={props.id}
        testId={props['data-testid']}
      />
    )
  }

  if (props.wizard) {
    return (
      <WizardCreateForm
        island={props}
        values={values}
        state={state}
        ctx={ctx}
        onFieldChange={handleFieldChange}
      />
    )
  }

  return (
    <CreateUpdateForm
      island={props}
      values={values}
      state={state}
      ctx={ctx}
      onFieldChange={handleFieldChange}
    />
  )
}
