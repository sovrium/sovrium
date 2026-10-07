/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Dialog } from '@base-ui/react/dialog'
import { useCallback } from 'react'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { DialogActions } from './dialog-actions'
import { dispatchConfirmAction, type DialogConfirmAction } from './dialog-confirm-action'
import { useDialogOpenState, useDismissalGuard, useHostControls } from './dialog-open-state'
import { useLiveInjectedMarkup } from './live-injected-markup'
import {
  computeAlertDialogPopupClasses,
  computeDialogDescriptionClasses,
  computeDialogPopupClasses,
  computeDialogTitleClasses,
  computeOverlayBackdropClasses,
} from './overlay-default-classes'
import type { MouseEvent, ReactElement } from 'react'

interface DialogIslandProps {
  readonly title?: string
  readonly description?: string
  /** The header close button's name, in the page language (`dialog.close`). */
  readonly closeLabel?: string
  readonly cancelLabel?: string
  readonly confirmLabel?: string
  /** Text to type before confirm enables (`alert-dialog.confirmText`), resolved on the server. */
  readonly confirmText?: string
  readonly variant?: 'default' | 'destructive'
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
  /** Serialized children HTML from SSR (rendered inside the popup body) */
  readonly childrenHtml?: string
  /**
   * Automation action dispatched when the confirm button is pressed.
   * When present and `type: 'automation'`, confirming POSTs the action to the
   * form-action endpoint BEFORE closing the dialog so the gated automation
   * actually fires. Absent ⇒ confirm only closes.
   */
  readonly action?: DialogConfirmAction
  /**
   * True when a trigger in the page config opens this dialog — decided on the
   * server, so a trigger not drawn yet (an unopened tab panel) still keeps the
   * dialog closed until it is pressed.
   */
  readonly hasOpener?: boolean
}

/**
 * The dialog's body: the SSR-rendered children, injected when the popup opens.
 *
 * The popup does not exist until the dialog opens, so this markup arrives after
 * the page's first-load pass — `useLiveInjectedMarkup` runs its scripts and
 * mounts its island markers, which is what lets a form placed in a dialog
 * submit through its action. Closing unmounts the popup, and with it those
 * islands, so a reopened dialog holds exactly one live copy.
 *
 * SECURITY: `html` is server-rendered from the app's configuration, not user
 * input.
 */
function DialogChildren({
  html,
  className,
  onCancel,
}: {
  readonly html: string
  readonly className?: string
  /** Closes the dialog: a hosted form's Cancel (`data-dialog-cancel`) was pressed. */
  readonly onCancel: (event: MouseEvent<HTMLDivElement>) => void
}): ReactElement {
  const ref = useLiveInjectedMarkup(html)
  return (
    <div
      ref={ref}
      className={className}
      onClick={onCancel}
    />
  )
}

interface DialogPopupBodyProps {
  readonly isAlertDialog: boolean
  readonly title?: string
  readonly description?: string
  readonly closeLabel: string
  readonly cancelLabel: string
  readonly confirmLabel?: string
  readonly confirmText?: string
  readonly variant: 'default' | 'destructive'
  readonly className?: string
  readonly id?: string
  readonly testId?: string
  readonly childrenHtml?: string
  readonly onConfirm?: () => void
  readonly onCancel: (event: MouseEvent<HTMLDivElement>) => void
}

function DialogPopupBody({
  isAlertDialog,
  title,
  description,
  closeLabel,
  cancelLabel,
  confirmLabel,
  confirmText,
  variant,
  className,
  id,
  testId,
  childrenHtml,
  onConfirm,
  onCancel,
}: DialogPopupBodyProps): ReactElement {
  return (
    <Dialog.Popup
      role={isAlertDialog ? 'alertdialog' : 'dialog'}
      className={resolveClasses(
        isAlertDialog ? computeAlertDialogPopupClasses() : computeDialogPopupClasses(),
        className
      )}
      id={id}
      data-testid={testId}
    >
      {title && <Dialog.Title className={computeDialogTitleClasses()}>{title}</Dialog.Title>}
      {description && (
        <Dialog.Description className={computeDialogDescriptionClasses()}>
          {description}
        </Dialog.Description>
      )}
      {childrenHtml && (
        <DialogChildren
          html={childrenHtml}
          className="mb-4"
          onCancel={onCancel}
        />
      )}
      <DialogActions
        isAlertDialog={isAlertDialog}
        closeLabel={closeLabel}
        cancelLabel={cancelLabel}
        confirmLabel={confirmLabel}
        confirmText={confirmText}
        variant={variant}
        onConfirm={onConfirm}
      />
    </Dialog.Popup>
  )
}

/**
 * Dialog island — wraps Base UI Dialog for modal dialogs and alert dialogs.
 *
 * Provides focus trapping, escape-to-close, backdrop click dismissal,
 * and animated enter/exit transitions out of the box.
 */
export default function DialogIsland({
  title,
  description,
  closeLabel = 'Close',
  cancelLabel = 'Cancel',
  confirmLabel,
  confirmText,
  variant = 'default',
  className,
  id,
  childrenHtml,
  action,
  hasOpener,
  'data-testid': testId,
}: DialogIslandProps): ReactElement {
  const isAlertDialog = variant === 'destructive' || confirmLabel !== undefined
  const { open, setOpen, onOpenChangeComplete, onCancel } = useDialogOpenState(hasOpener, id)

  // Dispatch the confirm button's configured automation action before
  // the Base UI `Dialog.Close` collapses the dialog. No action ⇒ confirm closes.
  const handleConfirm = useCallback((): void => dispatchConfirmAction(action), [action])
  const handleOpenChange = useDismissalGuard(isAlertDialog, setOpen)
  // The host names the dialog; while open it points at the portaled panel.
  const { id: panelId, anchor } = useHostControls(open, id)

  return (
    <Dialog.Root
      modal
      open={open}
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
    >
      {anchor}
      <Dialog.Portal>
        <Dialog.Backdrop
          data-overlay
          className={computeOverlayBackdropClasses()}
        />
        <DialogPopupBody
          isAlertDialog={isAlertDialog}
          title={title}
          description={description}
          closeLabel={closeLabel}
          cancelLabel={cancelLabel}
          confirmLabel={confirmLabel}
          confirmText={confirmText}
          variant={variant}
          className={className}
          id={panelId}
          testId={testId}
          childrenHtml={childrenHtml}
          onConfirm={handleConfirm}
          onCancel={onCancel}
        />
      </Dialog.Portal>
    </Dialog.Root>
  )
}
