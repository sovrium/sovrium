/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState, type FormEvent } from 'react'
import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { cn } from '@/presentation/design/class-merge'
import { pendingControlProps } from '@/presentation/design/pending-state'
import { renderPendingContent } from '@/presentation/design/spinner-mark'
import { toastWriteFailure, toastWriteRefusal } from '../runtime/write-refusal'

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
  /** The page-language strings, for a refusal's toast. */
  readonly uiStrings?: Readonly<Record<string, string>> | undefined
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

/**
 * Post the delete form from the script, once. A refusal because the writes
 * were too many keeps the reader on the page with a toast saying how long to
 * wait; an accepted delete goes where the form would have gone (or reloads the
 * page when that place is not one of the app's own paths); any other answer,
 * and a lost connection, is said once in a toast. The delete is never sent a
 * second time: a page without scripts posts the form itself, and only then.
 */
async function submitDeleteForm(
  form: HTMLFormElement,
  redirectUrl: string,
  strings: Readonly<Record<string, string>> | undefined
): Promise<void> {
  const response = await fetch(form.action, {
    method: 'POST',
    body: new URLSearchParams([...new FormData(form)].map(([k, v]) => [k, String(v)])),
    headers: { accept: 'application/json' },
    credentials: 'same-origin',
    redirect: 'manual',
  }).catch(() => undefined)
  if (response !== undefined && toastWriteRefusal(response, strings)) return
  if (response === undefined || (response.type !== 'opaqueredirect' && !response.ok)) {
    toastWriteFailure(strings)
    return
  }
  const target = toSafeRedirectPath(redirectUrl)
  if (target === undefined) window.location.reload()
  else window.location.assign(target)
}

function DeleteFormButton({
  table,
  recordId,
  redirectUrl,
  label,
  isPending,
  pendingLabel,
  strings,
}: {
  readonly table: string
  readonly recordId: string
  readonly redirectUrl: string
  readonly label: string
  readonly isPending: boolean
  readonly pendingLabel?: string | undefined
  readonly strings?: Readonly<Record<string, string>> | undefined
}) {
  const [sending, setSending] = useState(false)
  const busy = isPending || sending
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setSending(true)
    void submitDeleteForm(event.currentTarget, redirectUrl, strings).finally(() =>
      setSending(false)
    )
  }
  return (
    <form
      method="POST"
      action={buildDeleteFormAction(table, recordId)}
      onSubmit={onSubmit}
    >
      <input
        type="hidden"
        name="_redirect"
        value={redirectUrl}
      />
      <button
        type="submit"
        {...pendingControlProps(busy)}
      >
        {busy ? renderPendingContent(pendingLabel ?? 'Deleting…') : label}
      </button>
    </form>
  )
}

/**
 * The delete control: a confirm step when asked; a form post (enhanced by
 * script) when a redirect is configured; otherwise an in-place delete that
 * stays on the page and shows the deleted state.
 */
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

  const word = (key: string, english: string) => props.uiStrings?.[key] ?? english
  if (state.deleted) return <p>{word('form.recordDeleted', 'This record has been deleted.')}</p>

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
        <p>{props.confirmMessage ?? word('form.confirmPrompt', 'Are you sure?')}</p>
        <ActionButton
          label={word('form.confirmNamed', 'Confirm {label}').replace('{label}', label)}
          onClick={onSubmit}
          {...busy}
        />
        <button
          type="button"
          onClick={() => setShowConfirm(false)}
        >
          {word('form.cancel', 'Cancel')}
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
        strings={props.uiStrings}
        {...busy}
      />
    )
  }
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
