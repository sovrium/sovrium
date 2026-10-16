/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Dialog } from '@base-ui/react/dialog'
import { useCallback } from 'react'
import {
  computeAlertDialogMediaClasses,
  computeDialogContentClasses,
  computeDialogFooterClasses,
  computeDialogOverlayClasses,
  type DialogKind,
} from '@/presentation/design/dialog-default-classes'
import { LucideGlyph } from '@/presentation/design/lucide-glyph'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { DialogActions, type TypedConfirmPrompt } from './dialog-actions'
import { dispatchConfirmAction, type DialogConfirmAction } from './dialog-confirm-action'
import { useDialogOpenState, useDismissalGuard, useHostControls } from './dialog-open-state'
import { DialogChildren, DialogHeading } from './dialog-parts'
import { wrapTabWithin } from './focus-wrap'
import { useOverlayPending } from './overlay-pending'
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
  readonly confirmPrompt?: TypedConfirmPrompt // the field's label, in the page language
  readonly variant?: 'default' | 'destructive'
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
  /** Serialized children HTML from SSR (rendered inside the popup body) */
  readonly childrenHtml?: string
  /** Serialized `footer` slot HTML from SSR, drawn in the popup's footer band. */
  readonly footerHtml?: string
  /** `false` draws no corner close button (the dialog's `showCloseButton`). */
  readonly showCloseButton?: boolean
  /** An alert dialog's size, named on the popup as `data-size`. */
  readonly size?: 'default' | 'sm'
  /** An alert dialog's icon, as server-resolved Lucide geometry. */
  readonly iconNode?: unknown
  readonly iconName?: string
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

/** An alert dialog's icon tile, decorative; `undefined` when it names no icon. */
const mediaOf = (iconNode: unknown, iconName: string | undefined): ReactElement | undefined =>
  iconNode === undefined ? undefined : (
    <div
      data-slot="alert-dialog-media"
      aria-hidden="true"
      className={computeAlertDialogMediaClasses()}
    >
      <LucideGlyph
        iconNode={iconNode}
        name={iconName}
      />
    </div>
  )

/** The body: the authored children, then the `footer` slot in the band at the popup's foot. */
function BodySlots({
  kind,
  childrenHtml,
  footerHtml,
  onCancel,
}: {
  readonly kind: DialogKind
  readonly childrenHtml?: string
  readonly footerHtml?: string
  readonly onCancel: (event: MouseEvent<HTMLDivElement>) => void
}): ReactElement {
  return (
    <>
      {childrenHtml && (
        <DialogChildren
          html={childrenHtml}
          onCancel={onCancel}
        />
      )}
      {footerHtml && (
        <div
          data-slot={`${kind}-footer`}
          className={`${computeDialogFooterClasses(kind)} *:contents`}
        >
          <DialogChildren
            html={footerHtml}
            onCancel={onCancel}
          />
        </div>
      )}
    </>
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
  readonly confirmPrompt?: TypedConfirmPrompt
  readonly variant: 'default' | 'destructive'
  readonly className?: string
  readonly id?: string
  readonly testId?: string
  readonly childrenHtml?: string
  readonly footerHtml?: string
  readonly showCloseButton?: boolean
  readonly size?: 'default' | 'sm'
  readonly media?: ReactElement
  readonly onConfirm?: () => void
  readonly onCancel: (event: MouseEvent<HTMLDivElement>) => void
  readonly panelRef: (node: HTMLElement | null) => void
}

function DialogPopupBody({
  isAlertDialog,
  title,
  description,
  closeLabel,
  cancelLabel,
  confirmLabel,
  confirmText,
  confirmPrompt,
  variant,
  className,
  id,
  testId,
  childrenHtml,
  footerHtml,
  showCloseButton,
  size,
  media,
  onConfirm,
  onCancel,
  panelRef,
}: DialogPopupBodyProps): ReactElement {
  const kind: DialogKind = isAlertDialog ? 'alert-dialog' : 'dialog'
  return (
    <Dialog.Popup
      ref={panelRef}
      role={isAlertDialog ? 'alertdialog' : 'dialog'}
      data-slot={`${kind}-content`}
      data-size={isAlertDialog ? (size ?? 'default') : undefined}
      className={resolveClasses(computeDialogContentClasses(kind), className)}
      id={id}
      data-testid={testId}
      onKeyDown={wrapTabWithin}
    >
      <DialogHeading
        kind={kind}
        title={title}
        description={description}
        media={media}
      />
      <BodySlots
        kind={kind}
        childrenHtml={childrenHtml}
        footerHtml={footerHtml}
        onCancel={onCancel}
      />
      <DialogActions
        showCloseButton={showCloseButton}
        kind={kind}
        closeLabel={closeLabel}
        cancelLabel={cancelLabel}
        confirmLabel={confirmLabel}
        confirmText={confirmText}
        confirmPrompt={confirmPrompt}
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
 * and animated enter/exit transitions out of the box. Confirm dispatches its
 * automation (if any) before `Dialog.Close` collapses the dialog; a pending
 * control inside holds the reader's dismissals (`overlay-pending.ts`); the host
 * names the dialog, and while open points at the portaled panel.
 */
export default function DialogIsland(props: DialogIslandProps): ReactElement {
  const { closeLabel = 'Close', cancelLabel = 'Cancel', variant = 'default', id } = props
  const { action, hasOpener, iconNode, iconName, 'data-testid': testId, ...body } = props
  const isAlertDialog = variant === 'destructive' || props.confirmLabel !== undefined
  const { open, setOpen, onOpenChangeComplete, onCancel } = useDialogOpenState(hasOpener, id)
  const handleConfirm = useCallback((): void => dispatchConfirmAction(action), [action])
  const { panelRef, onOpenChange } = useOverlayPending(useDismissalGuard(isAlertDialog, setOpen))
  const { id: panelId, anchor } = useHostControls(open, id)

  return (
    <Dialog.Root
      modal
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
    >
      {anchor}
      <Dialog.Portal>
        <Dialog.Backdrop
          data-overlay
          data-slot={isAlertDialog ? 'alert-dialog-overlay' : 'dialog-overlay'}
          className={computeDialogOverlayClasses()}
        />
        <DialogPopupBody
          {...body}
          isAlertDialog={isAlertDialog}
          closeLabel={closeLabel}
          cancelLabel={cancelLabel}
          variant={variant}
          id={panelId}
          testId={testId}
          media={mediaOf(iconNode, iconName)}
          onConfirm={handleConfirm}
          onCancel={onCancel}
          panelRef={panelRef}
        />
      </Dialog.Portal>
    </Dialog.Root>
  )
}
