/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState } from 'react'
import { cn } from '@/presentation/design/class-merge'
import { pendingControlProps } from '@/presentation/design/pending-state'
import { renderPendingContent } from '@/presentation/design/spinner-mark'

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
  /** The delete button's caption while the delete is in flight, in the page language. */
  readonly pendingLabel?: string
}

function ActionButton({
  label,
  onClick,
  isPending,
  pendingLabel,
}: {
  readonly label: string
  readonly onClick: () => void
  readonly isPending?: boolean
  readonly pendingLabel?: string | undefined
}) {
  const pending = isPending === true
  return (
    <button
      type="button"
      onClick={pending ? undefined : onClick}
      {...pendingControlProps(pending)}
    >
      {pending ? renderPendingContent(pendingLabel ?? 'Deleting…') : label}
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
  pendingLabel,
}: {
  readonly table: string
  readonly recordId: string
  readonly redirectUrl: string
  readonly label: string
  readonly isPending: boolean
  readonly pendingLabel?: string | undefined
}) {
  return (
    <form
      method="POST"
      action={buildDeleteFormAction(table, recordId)}
      onSubmit={isPending ? (event) => event.preventDefault() : undefined}
    >
      <input
        type="hidden"
        name="_redirect"
        value={redirectUrl}
      />
      <button
        type="submit"
        {...pendingControlProps(isPending)}
      >
        {isPending ? renderPendingContent(pendingLabel ?? 'Deleting…') : label}
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
  const busy = { isPending: state.isPending, pendingLabel: props.pendingLabel }

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
          {...busy}
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
  // Form-based POST when redirect URL is configured (guarantees DB consistency)
  if (recordId && props.redirectUrl) {
    return (
      <DeleteFormButton
        table={table}
        recordId={recordId}
        redirectUrl={props.redirectUrl}
        label={label}
        {...busy}
      />
    )
  }
  // Async mutation (stays on same page, shows deleted state)
  return (
    <ActionButton
      label={label}
      onClick={onSubmit}
      {...busy}
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
