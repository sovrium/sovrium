/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import { DeleteView } from '../parts/crud-delete-view'
import { CreateUpdateForm } from './create-update-form'
import { useCrudFormState } from './state'
import { submitCrudForm } from './submit-pipeline'
import { type CrudFormIslandProps } from './types'

/** How many fields hold a value other than the one the form was filled with. */
const countChanges = (filled: Record<string, string>, values: Record<string, string>): number =>
  Object.keys({ ...filled, ...values }).filter(
    (name) => (filled[name] ?? '') !== (values[name] ?? '')
  ).length

export default function CrudFormIsland(props: CrudFormIslandProps) {
  const { values, filled, state, ctx, handleFieldChange, discardChanges } = useCrudFormState(props)

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

  return (
    <CreateUpdateForm
      island={props}
      values={values}
      state={state}
      ctx={ctx}
      onFieldChange={handleFieldChange}
      changes={props.stickyActions === true ? countChanges(filled, values) : undefined}
      onDiscard={discardChanges}
    />
  )
}
