/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Dialog } from '@base-ui/react/dialog'
import { useEffect, useId, useState } from 'react'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import {
  computeDialogCloseClasses,
  computeDialogFooterClasses,
  type DialogKind,
} from '@/presentation/design/dialog-default-classes'
import { computeInputDefaultClasses } from '@/presentation/design/input-default-classes'
import { OverlayCloseGlyph } from '@/presentation/design/overlay-close-glyph'
import {
  resolveSessionTemplate,
  restoreInertTemplateValue,
  type SessionUser,
} from '@/presentation/design/session-template'
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

/** The typed confirmation's label, in the page language: `{text}` is the text to type. */
export interface TypedConfirmPrompt {
  readonly named: string
  readonly asked: string
}

/** The one field a typed confirmation draws, labelled with the text to type. */
function TypedConfirmField({
  expected,
  prompt,
  typed,
  onType,
}: {
  readonly expected: string | undefined
  readonly prompt: TypedConfirmPrompt | undefined
  readonly typed: string
  readonly onType: (next: string) => void
}): ReactElement {
  const inputId = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className="text-muted-foreground text-sm"
      >
        {expected
          ? (prompt?.named ?? 'To confirm, type “{text}”').split('{text}').join(expected)
          : (prompt?.asked ?? 'To confirm, type the text asked for')}
      </label>
      <input
        id={inputId}
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={typed}
        onChange={(event) => onType(event.target.value)}
        className={computeInputDefaultClasses()}
      />
    </div>
  )
}

/** The `dialog-close` corner button a dialog with nothing to confirm draws. */
function CornerClose({ closeLabel }: { readonly closeLabel: string }): ReactElement {
  return (
    <Dialog.Close
      data-component-type="button"
      data-overlay-close=""
      data-slot="dialog-close"
      aria-label={closeLabel}
      className={computeDialogCloseClasses()}
    >
      <OverlayCloseGlyph />
    </Dialog.Close>
  )
}

/** The confirm button, locked while a typed confirmation is unmet. */
function ConfirmButton(props: {
  readonly kind: DialogKind
  readonly confirmLabel: string
  readonly variant: 'default' | 'destructive'
  readonly locked: boolean
  readonly onConfirm?: () => void
}): ReactElement {
  return (
    <Dialog.Close
      data-component-type="button"
      data-slot={props.kind === 'alert-dialog' ? 'alert-dialog-action' : undefined}
      onClick={props.onConfirm}
      disabled={props.locked}
      className={computeButtonDefaultClasses({ variant: props.variant })}
    >
      {props.confirmLabel}
    </Dialog.Close>
  )
}

/** The `*-footer` band: Cancel (alert dialog) and confirm, or the corner close. */
function DialogFooter(props: {
  readonly kind: DialogKind
  readonly closeLabel: string
  readonly cancelLabel: string
  readonly confirmLabel?: string
  readonly variant: 'default' | 'destructive'
  readonly locked: boolean
  readonly onConfirm?: () => void
}): ReactElement {
  return (
    <div
      data-slot={`${props.kind}-footer`}
      className={computeDialogFooterClasses(props.kind)}
    >
      {props.kind === 'alert-dialog' && (
        <Dialog.Close
          data-component-type="button"
          data-overlay-close=""
          data-slot="alert-dialog-cancel"
          className={computeButtonDefaultClasses({ variant: 'outline' })}
        >
          {props.cancelLabel}
        </Dialog.Close>
      )}
      {props.confirmLabel ? (
        <ConfirmButton
          kind={props.kind}
          confirmLabel={props.confirmLabel}
          variant={props.variant}
          locked={props.locked}
          onConfirm={props.onConfirm}
        />
      ) : (
        <CornerClose closeLabel={props.closeLabel} />
      )}
    </div>
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
  kind,
  closeLabel,
  cancelLabel,
  confirmLabel,
  confirmText,
  confirmPrompt,
  variant,
  onConfirm,
  showCloseButton,
}: {
  /** `false` draws no corner close button. */
  readonly showCloseButton?: boolean
  readonly kind: DialogKind
  readonly closeLabel: string
  readonly cancelLabel: string
  readonly confirmLabel?: string
  /** Text the reader must type before confirm enables (already resolved). */
  readonly confirmText?: string
  readonly confirmPrompt?: TypedConfirmPrompt
  readonly variant: 'default' | 'destructive'
  /** Fired when the confirm button is pressed, BEFORE the dialog closes. */
  readonly onConfirm?: () => void
}): ReactElement | null {
  const [typed, setTyped] = useState('')
  const expected = useExpectedText(confirmText?.trim())
  const asks = confirmText !== undefined && confirmText.trim() !== ''
  const locked = asks && (expected === undefined || expected === '' || typed.trim() !== expected)
  if (!confirmLabel && kind !== 'alert-dialog') {
    return showCloseButton === false ? null : <CornerClose closeLabel={closeLabel} />
  }
  return (
    <>
      {asks && (
        <TypedConfirmField
          expected={expected}
          prompt={confirmPrompt}
          typed={typed}
          onType={setTyped}
        />
      )}
      <DialogFooter
        kind={kind}
        closeLabel={closeLabel}
        cancelLabel={cancelLabel}
        confirmLabel={confirmLabel}
        variant={variant}
        locked={locked}
        onConfirm={onConfirm}
      />
    </>
  )
}
