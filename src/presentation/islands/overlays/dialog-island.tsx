/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Dialog } from '@base-ui/react/dialog'
import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/presentation/utils/design/class-merge'
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

/** Base UI dismissal reasons blocked for alert-dialogs (confirmation must be explicit). */
const ALERT_DIALOG_BLOCKED_REASONS = new Set([
  'escape-key',
  'close-watcher',
  'outside-press',
  'focus-out',
])

/**
 * Wires the `data-click-modal="<id>"` attribute emitted by the interaction
 * props builder to re-open this dialog after dismissal. The legacy openModal
 * handler in `PageBodyScripts` only toggles `display` on the placeholder div,
 * which has no effect on a hydrated Base UI portal — so the island owns the
 * external-trigger contract for itself.
 */
/**
 * Whether the page declares an external trigger (`data-click-modal="<id>"`,
 * emitted by `interactions.click.modal`) pointing at this dialog. A
 * trigger-controlled dialog mounts CLOSED (GAP-2); a standalone dialog with no
 * trigger keeps the open-by-default behaviour. Runs client-side only (mount).
 */
function hasExternalTrigger(id: string | undefined): boolean {
  if (!id || typeof document === 'undefined') return false
  return document.querySelector(`[data-click-modal="${id}"]`) !== null
}

/**
 * Initial open state (GAP-2): a TRIGGER-controlled dialog mounts CLOSED so its
 * backdrop never intercepts clicks on (and its focus-trap never hides from the
 * accessibility tree) sibling elements on load; its `data-click-modal` trigger
 * (`useExternalOpenTrigger`) opens it on activation. This applies to plain
 * dialogs AND alert-dialogs alike: a confirmation alert-dialog wired to an
 * external trigger (e.g. a "Destroy" button) must mount closed, otherwise it
 * pops open on load and traps focus, hiding the sibling action buttons from the
 * accessibility tree. A STANDALONE dialog/alert-dialog — no trigger element
 * points at its id — keeps the open-by-default behaviour relied on by the
 * standalone-hydration and dialog-theming specs.
 */
function computeInitialOpen(_isAlertDialog: boolean, id: string | undefined): boolean {
  return !hasExternalTrigger(id)
}

/**
 * Consume the one-shot handoff flag the inline `clickScript` sets in
 * `window.__sovriumOpenModals` on a pre-hydration trigger click (see
 * PageBodyScripts). Returns true (and clears the flag) when a click for `id`
 * landed before this lazy island hydrated, so the closed-on-mount dialog still
 * opens. `Reflect.deleteProperty` mutates this transient client-side window
 * registry (not domain state) exactly once.
 */
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
    // Replay a trigger click that landed BEFORE this (lazy) island hydrated.
    if (consumePendingOpen(id)) setOpen(true)
    // Re-check on the next frame to close the narrow race where the click (and
    // its flag write) lands between this effect's read and listener attach.
    const raf = requestAnimationFrame(() => {
      if (consumePendingOpen(id)) setOpen(true)
    })
    const handler = (event: Event): void => {
      const target = event.target as HTMLElement | null
      const trigger = target?.closest(`[data-click-modal="${id}"]`)
      if (trigger) setOpen(true)
    }
    // Capture phase: fire before the bubble-phase clickScript and any
    // stopPropagation, so a trigger click reliably opens a hydrated dialog.
    document.addEventListener('click', handler, true)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('click', handler, true)
    }
  }, [id, setOpen])
}

/**
 * Build the `onOpenChange` handler for the dialog. For alert dialogs, Escape /
 * outside-press / focus-out dismissals are BLOCKED — confirmation must be
 * explicit (Cancel / Confirm button). Regular dialogs dismiss freely. Extracted
 * to a hook so the island component stays under its line cap.
 */
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
  /** Serialized children HTML from SSR (rendered inside the popup body) */
  readonly childrenHtml?: string
  /**
   * Automation action dispatched when the confirm button is pressed.
   * When present and `type: 'automation'`, confirming POSTs the action to the
   * form-action endpoint BEFORE closing the dialog so the gated automation
   * actually fires. Absent ⇒ confirm only closes.
   */
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
  /** Fired when the confirm button is pressed, BEFORE the dialog closes. */
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

/**
 * Renders SSR placeholder HTML once on initial paint while the island hydrates.
 * Isolated so the per-call object literal in `dangerouslySetInnerHTML` lives in
 * a tiny dedicated component, not in the parent island body.
 */
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
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- preserves SSR skeleton HTML; helper invoked once on first paint
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

/**
 * Dialog island — wraps Base UI Dialog for modal dialogs and alert dialogs.
 *
 * Provides focus trapping, escape-to-close, backdrop click dismissal,
 * and animated enter/exit transitions out of the box.
 */
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

  // Dispatch the confirm button's configured automation action before
  // the Base UI `Dialog.Close` collapses the dialog. No action ⇒ confirm closes.
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
