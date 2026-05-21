/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { useState } from 'react'
import { cn } from '@/presentation/islands/lib/cn'

interface FormState {
  readonly error?: string
  readonly fieldError?: { readonly field: string; readonly message: string }
  readonly isPending: boolean
  readonly deleted?: boolean
}

export interface DeleteViewProps {
  readonly confirm?: boolean
  readonly confirmMessage?: string
  readonly buttonLabel?: string
  readonly state: FormState
  readonly onSubmit: () => void
  readonly table: string
  readonly recordId?: string
  readonly redirectUrl?: string
  readonly className?: string
  readonly id?: string
  readonly testId?: string
}

function ActionButton({
  label,
  onClick,
  isPending,
}: {
  readonly label: string
  readonly onClick: () => void
  readonly isPending?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
    >
      {isPending ? 'Deleting...' : label}
    </button>
  )
}

function DeleteWrapper({
  className,
  id,
  testId,
  error,
  children,
}: {
  readonly className?: string
  readonly id?: string
  readonly testId?: string
  readonly error?: string
  readonly children: React.ReactNode
}) {
  return (
    <div
      className={cn(className)}
      id={id}
      data-testid={testId}
    >
      {error && <div role="alert">{error}</div>}
      {children}
    </div>
  )
}

function buildDeleteFormAction(table: string, recordId: string): string {
  return `/api/tables/${encodeURIComponent(table)}/records/${encodeURIComponent(recordId)}/delete`
}

function DeleteFormButton({
  table,
  recordId,
  redirectUrl,
  label,
  isPending,
}: {
  readonly table: string
  readonly recordId: string
  readonly redirectUrl: string
  readonly label: string
  readonly isPending: boolean
}) {
  return (
    <form
      method="POST"
      action={buildDeleteFormAction(table, recordId)}
    >
      <input
        type="hidden"
        name="_redirect"
        value={redirectUrl}
      />
      <button
        type="submit"
        disabled={isPending}
      >
        {isPending ? 'Deleting...' : label}
      </button>
    </form>
  )
}

function DeleteContent({
  props,
  label,
}: {
  readonly props: DeleteViewProps
  readonly label: string
}) {
  const { state, confirm, onSubmit, table, recordId } = props
  const [showConfirm, setShowConfirm] = useState(false)

  if (state.deleted) return <p>This record has been deleted.</p>

  if (confirm && !showConfirm) {
    return (
      <ActionButton
        label={label}
        onClick={() => setShowConfirm(true)}
      />
    )
  }
  if (confirm && showConfirm) {
    return (
      <>
        <p>{props.confirmMessage ?? 'Are you sure?'}</p>
        <ActionButton
          label={`Confirm ${label}`}
          onClick={onSubmit}
          isPending={state.isPending}
        />
        <button
          type="button"
          onClick={() => setShowConfirm(false)}
        >
          Cancel
        </button>
      </>
    )
  }
  if (recordId && props.redirectUrl) {
    return (
      <DeleteFormButton
        table={table}
        recordId={recordId}
        redirectUrl={props.redirectUrl}
        label={label}
        isPending={state.isPending}
      />
    )
  }
  return (
    <ActionButton
      label={label}
      onClick={onSubmit}
      isPending={state.isPending}
    />
  )
}

export function DeleteView(props: DeleteViewProps) {
  const { className, id, testId, state, buttonLabel } = props
  const w = { className, id, testId, error: state.error }
  const label = buttonLabel ?? 'Delete'

  return (
    <DeleteWrapper {...w}>
      <DeleteContent
        props={props}
        label={label}
      />
    </DeleteWrapper>
  )
}
