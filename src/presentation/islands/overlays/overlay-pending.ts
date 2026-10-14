/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * An overlay that holds a control whose request is in flight waits for it.
 *
 * While a `[data-pending="true"]` control is inside the panel, the reader's
 * own dismissals — Escape, a press outside or on the backdrop, the overlay's
 * Close and Cancel — do nothing, and those controls are disabled: closing the
 * panel mid-request would hide the answer the reader is waiting for. The
 * overlay's PROGRAMMATIC close (a saved form closing its dialog, an endpoint
 * form's `close`) goes through `setOpen` directly and is not filtered.
 *
 * One hook for the dialog, the drawer, the record drawer and the popover: the
 * panel element arrives through `panelRef`, an observer keeps the close
 * controls in step with the pending mark, and the returned `onOpenChange` wraps
 * the overlay's own.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

const PENDING = '[data-pending="true"]'
/** The overlay's own close controls: Base UI Close, a hosted form's Cancel. */
const CLOSERS = '[data-overlay-close], [data-dialog-cancel]'
/** Marks a close control disabled HERE, so only those are given back. */
const LOCKED = 'data-pending-locked'

function lockClosers(panel: Element, pending: boolean): void {
  panel.querySelectorAll(CLOSERS).forEach((closer) => {
    if (pending && !closer.hasAttribute('disabled')) {
      closer.setAttribute('disabled', '')
      closer.setAttribute(LOCKED, '')
    } else if (!pending && closer.hasAttribute(LOCKED)) {
      closer.removeAttribute('disabled')
      closer.removeAttribute(LOCKED)
    }
  })
}

export interface OverlayPending<D> {
  /** Attach to the overlay's panel (the popup element). */
  readonly panelRef: (node: HTMLElement | null) => void
  /** The overlay's `onOpenChange`, ignoring a close while the panel holds a pending control. */
  readonly onOpenChange: (open: boolean, details: D) => void
}

/**
 * Close the overlay when a control inside its panel asks to (`sovrium:close-dialog`,
 * `islands/runtime/action-outcome.ts`) — only when that panel is the innermost
 * `[role="dialog"]` around the control, so of two nested overlays only the one
 * the reader was looking at closes. A programmatic close: the pending guard
 * does not filter it.
 */
function useCloseRequest(
  panel: { readonly current: HTMLElement | null },
  close: (() => void) | undefined
): void {
  useEffect(() => {
    if (close === undefined) return undefined
    const onRequest = (event: Event): void => {
      const owner = (event.target as Element | null)?.closest?.('[role="dialog"]')
      if (owner != null && owner === panel.current) close()
    }
    document.addEventListener('sovrium:close-dialog', onRequest)
    return () => document.removeEventListener('sovrium:close-dialog', onRequest)
  }, [panel, close])
}

/**
 * `close`, when given, is how the overlay closes itself on a close request
 * from a control inside it; an overlay that already listens on its own (the
 * dialog, the drawer) leaves it out.
 */
export function useOverlayPending<D>(
  onOpenChange: (open: boolean, details: D) => void,
  close?: () => void
): OverlayPending<D> {
  const panel = useRef<HTMLElement | null>(null)
  const [node, setNode] = useState<HTMLElement | null>(null)
  const panelRef = useCallback((element: HTMLElement | null) => {
    panel.current = element
    setNode(element)
  }, [])
  useEffect(() => {
    if (node === null) return undefined
    const sync = (): void => lockClosers(node, node.querySelector(PENDING) !== null)
    const observer = new MutationObserver(sync)
    observer.observe(node, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-pending'],
    })
    sync()
    return () => observer.disconnect()
  }, [node])
  const guarded = useCallback(
    (open: boolean, details: D): void => {
      if (!open && panel.current?.querySelector(PENDING) != null) {
        // Base UI moves its own state unless the change is cancelled: ignoring
        // the call alone lets the panel play its exit and reopen.
        ;(details as { readonly cancel?: () => void } | undefined)?.cancel?.()
        return
      }
      onOpenChange(open, details)
    },
    [onOpenChange]
  )
  useCloseRequest(panel, close)
  return { panelRef, onOpenChange: guarded }
}
