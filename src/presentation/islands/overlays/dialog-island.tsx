/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Dialog } from '@base-ui/react/dialog'
import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/presentation/islands/lib/cn'
import { dispatchConfirmAction, type DialogConfirmAction } from './dialog-confirm-action'
import {
  computeAlertDialogPopupClasses,
  computeDialogActionsClasses,
  computeDialogDescriptionClasses,
  computeDialogPopupClasses,
  computeDialogTitleClasses,
  computeOverlayBackdropClasses,
} from './overlay-default-classes'
import type { ReactElement } from 'react'

const ALERT_DIALOG_BLOCKED_REASONS = new Set([
  'escape-key',
  'close-watcher',
  'outside-press',
  'focus-out',
])

function hasExternalTrigger(id: string | undefined): boolean {
  if (!id || typeof document === 'undefined') return false
  return document.querySelector(`[data-click-modal="${id}"]`) !== null
}

function computeInitialOpen(_isAlertDialog: boolean, id: string | undefined): boolean {
  return !hasExternalTrigger(id)
}

function consumePendingOpen(id: string): boolean {
  const pending = (window as unknown as { __sovriumOpenModals?: Record<string, boolean> })
    .__sovriumOpenModals
  if (!pending?.[id]) return false
  Reflect.deleteProperty(pending, id)
  return true
}

function useExternalOpenTrigger(id: string | undefined, setOpen: (open: boolean) => void): void {
  useEffect(() => {
    if (!id) return
    if (consumePendingOpen(id)) setOpen(true)
    const raf = requestAnimationFrame(() => {
      if (consumePendingOpen(id)) setOpen(true)
    })
    const handler = (event: Event): void => {
      const target = event.target as HTMLElement | null
      const trigger = target?.closest(`[data-click-modal="${id}"]`)
      if (trigger) setOpen(true)
    }
    document.addEventListener('click', handler, true)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('click', handler, true)
    }
  }, [id, setOpen])
}

function useDismissalGuard(
  isAlertDialog: boolean,
  setOpen: (open: boolean) => void
): (nextOpen: boolean, eventDetails: { reason?: string } | undefined) => void {
  return useCallback(
    (nextOpen: boolean, eventDetails: { reason?: string } | undefined): void => {
      if (
        isAlertDialog &&
        eventDetails?.reason &&
        ALERT_DIALOG_BLOCKED_REASONS.has(eventDetails.reason)
      ) {
        return
      }
      setOpen(nextOpen)
    },
    [isAlertDialog, setOpen]
  )
}

interface DialogIslandProps {
  readonly title?: string
  readonly description?: string
  readonly cancelLabel?: string
  readonly confirmLabel?: string
  readonly variant?: 'default' | 'destructive'
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
  readonly childrenHtml?: string
  readonly action?: DialogConfirmAction
}

function DialogActions({
  isAlertDialog,
  cancelLabel,
  confirmLabel,
  variant,
  onConfirm,
}: {
  readonly isAlertDialog: boolean
  readonly cancelLabel: string
  readonly confirmLabel?: string
  readonly variant: 'default' | 'destructive'
  readonly onConfirm?: () => void
}): ReactElement {
  const confirmColorClass =
    variant === 'destructive'
      ? 'bg-error-solid text-error-solid-fg hover:opacity-90'
      : 'bg-primary text-primary-fg hover:bg-primary-hover'

  return (
    <div className={computeDialogActionsClasses()}>
      {isAlertDialog && (
        <Dialog.Close className="border-border bg-background text-foreground hover:bg-background-subtle rounded-md border px-4 py-2 text-sm font-medium transition-colors">
          {cancelLabel}
        </Dialog.Close>
      )}

      {confirmLabel ? (
        <Dialog.Close
          onClick={onConfirm}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${confirmColorClass}`}
        >
          {confirmLabel}
        </Dialog.Close>
      ) : (
        <Dialog.Close className="text-foreground-subtle hover:text-foreground-muted absolute top-4 right-4 transition-colors">
          <span
            className="sr-only"
            aria-hidden="true"
          >
            Close
          </span>
          ✕
        </Dialog.Close>
      )}
    </div>
  )
}

function SSRSkeletonDiv({
  html,
  className,
}: {
  readonly html: string
  readonly className?: string
}): ReactElement {
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

interface DialogPopupBodyProps {
  readonly isAlertDialog: boolean
  readonly title?: string
  readonly description?: string
  readonly cancelLabel: string
  readonly confirmLabel?: string
  readonly variant: 'default' | 'destructive'
  readonly className?: string
  readonly id?: string
  readonly testId?: string
  readonly childrenHtml?: string
  readonly onConfirm?: () => void
}

function DialogPopupBody({
  isAlertDialog,
  title,
  description,
  cancelLabel,
  confirmLabel,
  variant,
  className,
  id,
  testId,
  childrenHtml,
  onConfirm,
}: DialogPopupBodyProps): ReactElement {
  return (
    <Dialog.Popup
      role={isAlertDialog ? 'alertdialog' : 'dialog'}
      className={cn(
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
        <SSRSkeletonDiv
          html={childrenHtml}
          className="mb-4"
        />
      )}
      <DialogActions
        isAlertDialog={isAlertDialog}
        cancelLabel={cancelLabel}
        confirmLabel={confirmLabel}
        variant={variant}
        onConfirm={onConfirm}
      />
    </Dialog.Popup>
  )
}

export default function DialogIsland({
  title,
  description,
  cancelLabel = 'Cancel',
  confirmLabel,
  variant = 'default',
  className,
  id,
  childrenHtml,
  action,
  'data-testid': testId,
}: DialogIslandProps): ReactElement {
  const isAlertDialog = variant === 'destructive' || confirmLabel !== undefined
  const [open, setOpen] = useState(() => computeInitialOpen(isAlertDialog, id))

  useExternalOpenTrigger(id, setOpen)

  const handleConfirm = useCallback((): void => dispatchConfirmAction(action), [action])
  const handleOpenChange = useDismissalGuard(isAlertDialog, setOpen)

  return (
    <Dialog.Root
      modal
      open={open}
      onOpenChange={handleOpenChange}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          data-overlay
          className={computeOverlayBackdropClasses()}
        />
        <DialogPopupBody
          isAlertDialog={isAlertDialog}
          title={title}
          description={description}
          cancelLabel={cancelLabel}
          confirmLabel={confirmLabel}
          variant={variant}
          className={className}
          id={id}
          testId={testId}
          childrenHtml={childrenHtml}
          onConfirm={handleConfirm}
        />
      </Dialog.Portal>
    </Dialog.Root>
  )
}
