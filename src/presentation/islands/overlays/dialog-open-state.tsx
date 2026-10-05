/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The dialog island's open state and its host: whether it mounts open, how an
 * external trigger opens it, which dismissals an alert dialog refuses, and the
 * `aria-controls` its host carries while the panel is open. Imported by the
 * dialog island alone, so it ships inside that island's chunk.
 */

import { useCallback, useEffect, useId, useLayoutEffect, useRef } from 'react'
import type { ReactElement } from 'react'

/** Base UI dismissal reasons blocked for alert-dialogs (confirmation must be explicit). */
const ALERT_DIALOG_BLOCKED_REASONS = new Set([
  'escape-key',
  'close-watcher',
  'outside-press',
  'focus-out',
])

/**
 * Whether a trigger DRAWN on the page right now (`data-click-modal="<id>"`,
 * emitted by `interactions.click.modal`) points at this dialog. Only the
 * fallback for a dialog the server did not judge (`hasOpener` absent — one
 * rendered outside the page-config pass, whose trigger may sit in page chrome):
 * a trigger that is not drawn yet, in an unopened tab panel or another view of
 * the page, is invisible to it, which is why the server decides when it can.
 */
function hasExternalTrigger(id: string | undefined): boolean {
  if (!id || typeof document === 'undefined') return false
  return document.querySelector(`[data-click-modal="${id}"]`) !== null
}

/**
 * Initial open state: a dialog with an OPENER mounts CLOSED so its
 * backdrop never intercepts clicks on (and its focus-trap never hides from the
 * accessibility tree) sibling elements on load; its `data-click-modal` trigger
 * (`useExternalOpenTrigger`) opens it on activation. This applies to plain
 * dialogs AND alert-dialogs alike: a confirmation alert-dialog wired to an
 * external trigger (e.g. a "Destroy" button) must mount closed, otherwise it
 * pops open on load and traps focus, hiding the sibling action buttons from the
 * accessibility tree. A STANDALONE dialog/alert-dialog — no trigger element
 * points at its id — keeps the open-by-default behaviour relied on by the
 * standalone-hydration and dialog-theming specs.
 *
 * "Has an opener" is decided on the SERVER from the page config (`hasOpener`,
 * any `interactions.click.modal` naming this id, drawn yet or not), with the
 * drawn-trigger check as the fallback for a dialog the server did not judge.
 */
export function computeInitialOpen(
  hasOpener: boolean | undefined,
  id: string | undefined
): boolean {
  return !(hasOpener === true || hasExternalTrigger(id))
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

export function useExternalOpenTrigger(
  id: string | undefined,
  setOpen: (open: boolean) => void
): void {
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
export function useDismissalGuard(
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

/**
 * Point the island host at the open panel, as the record drawer's host does.
 *
 * The panel is portaled to `<body>`, out of the hidden host that names the
 * dialog. While open, the host carries `aria-controls` with the panel's id —
 * the author's `id`, or a generated one; closed, it carries nothing. The host
 * is reached through `anchor`, a hidden element rendered in place inside it.
 */
export function useHostControls(
  open: boolean,
  authorId: string | undefined
): { readonly id: string; readonly anchor: ReactElement } {
  const generated = useId()
  const id = authorId ?? generated
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const host = ref.current?.closest('[data-island]')
    if (!open || !host) return undefined
    host.setAttribute('aria-controls', id)
    return () => host.removeAttribute('aria-controls')
  }, [id, open])
  return {
    id,
    anchor: (
      <span
        ref={ref}
        hidden
      />
    ),
  }
}
