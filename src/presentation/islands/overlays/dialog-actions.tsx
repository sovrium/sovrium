/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Dialog } from '@base-ui/react/dialog'
import { useEffect, useId, useState } from 'react'
import {
  resolveSessionTemplate,
  restoreInertTemplateValue,
  type SessionUser,
} from '@/presentation/design/session-template'
import { computeDialogActionsClasses } from './overlay-default-classes'
import type { ReactElement } from 'react'

/**
 * The text to type, with a `$session.<field>` token resolved against the
 * reader's OWN session, fetched here rather than served: a cached page must not
 * carry one reader's email to the next. `$record.` tokens arrive resolved and
 * inert, so a record value is typed as stored and never read as a token.
 * Until the session answers, the text is `undefined` and confirm stays locked.
 */
function useExpectedText(confirmText: string | undefined): string | undefined {
  const bound = confirmText?.includes('$session.') === true
  const [user, setUser] = useState<SessionUser | null | undefined>(bound ? undefined : null)
  useEffect(() => {
    if (!bound) return
    void fetch('/api/auth/get-session', { credentials: 'include' })
      .then(async (res) => (res.ok ? ((await res.json()) as { user?: SessionUser }) : undefined))
      .then((body) => setUser(body?.user ?? null))
      .catch(() => setUser(null))
  }, [bound])
  if (confirmText === undefined) return undefined
  if (!bound) return restoreInertTemplateValue(confirmText)
  if (user === undefined) return undefined
  return restoreInertTemplateValue(resolveSessionTemplate(confirmText, user ?? undefined)).trim()
}

/** The one field a typed confirmation draws, labelled with the text to type. */
function TypedConfirmField({
  expected,
  typed,
  onType,
}: {
  readonly expected: string | undefined
  readonly typed: string
  readonly onType: (next: string) => void
}): ReactElement {
  const inputId = useId()
  return (
    <div className="mb-4 flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className="text-foreground-muted text-sm"
      >
        {expected ? `To confirm, type “${expected}”` : 'To confirm, type the text asked for'}
      </label>
      <input
        id={inputId}
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={typed}
        onChange={(event) => onType(event.target.value)}
        className="border-border bg-background text-foreground text-md focus-visible:outline-ring w-full rounded-md border px-3 py-2 font-mono focus-visible:outline-2 focus-visible:outline-offset-2"
      />
    </div>
  )
}

/** The confirm button — locked while a typed confirmation is unmet — or the corner close mark. */
function ConfirmOrClose(props: {
  readonly confirmLabel?: string
  readonly closeLabel: string
  readonly variant: 'default' | 'destructive'
  readonly locked: boolean
  readonly onConfirm?: () => void
}): ReactElement {
  if (!props.confirmLabel) {
    return (
      <Dialog.Close
        data-component-type="button"
        aria-label={props.closeLabel}
        className="text-foreground-subtle hover:text-foreground-muted absolute top-4 right-4 transition-colors"
      >
        <span aria-hidden="true">✕</span>
      </Dialog.Close>
    )
  }
  const tone =
    props.variant === 'destructive'
      ? 'bg-error-solid text-error-solid-fg hover:opacity-90'
      : 'bg-primary text-primary-fg hover:bg-primary-hover'
  return (
    <Dialog.Close
      data-component-type="button"
      onClick={props.onConfirm}
      disabled={props.locked}
      className={`text-md rounded-md px-4 py-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${tone}`}
    >
      {props.confirmLabel}
    </Dialog.Close>
  )
}

/**
 * The footer of the dialog island: Cancel, the confirm button, or the corner
 * close mark when nothing is confirmed. Split from `dialog-island.tsx` so the
 * typed confirmation it now carries does not push that island past its cap.
 *
 * TYPED CONFIRMATION — with `confirmText`, the footer draws one text field
 * above the buttons and keeps the confirm button disabled until the field
 * holds exactly that text (surrounding spaces ignored on both sides). The
 * comparison is case-sensitive on purpose: the point is that the reader typed
 * the name, not that they typed something close to it.
 */
export function DialogActions({
  isAlertDialog,
  closeLabel,
  cancelLabel,
  confirmLabel,
  confirmText,
  variant,
  onConfirm,
}: {
  readonly isAlertDialog: boolean
  readonly closeLabel: string
  readonly cancelLabel: string
  readonly confirmLabel?: string
  /** Text the reader must type before confirm enables (already resolved). */
  readonly confirmText?: string
  readonly variant: 'default' | 'destructive'
  /** Fired when the confirm button is pressed, BEFORE the dialog closes. */
  readonly onConfirm?: () => void
}): ReactElement {
  const [typed, setTyped] = useState('')
  const expected = useExpectedText(confirmText?.trim())
  const asks = confirmText !== undefined && confirmText.trim() !== ''
  const locked = asks && (expected === undefined || expected === '' || typed.trim() !== expected)
  return (
    <>
      {asks && (
        <TypedConfirmField
          expected={expected}
          typed={typed}
          onType={setTyped}
        />
      )}
      <div className={computeDialogActionsClasses()}>
        {isAlertDialog && (
          <Dialog.Close
            data-component-type="button"
            className="border-border bg-background text-foreground hover:bg-background-subtle text-md rounded-md border px-4 py-2 font-medium transition-colors"
          >
            {cancelLabel}
          </Dialog.Close>
        )}

        <ConfirmOrClose
          confirmLabel={confirmLabel}
          closeLabel={closeLabel}
          variant={variant}
          locked={locked}
          onConfirm={onConfirm}
        />
      </div>
    </>
  )
}
