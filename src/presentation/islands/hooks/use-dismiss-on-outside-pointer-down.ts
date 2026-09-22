/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shut a surface when the reader presses somewhere that is not it.
 *
 * ─── WHY THIS IS SHARED RATHER THAN WRITTEN TWICE ──────────────────────────
 *
 * The date picker and the date range picker are two components on purpose —
 * one period is not one date — but "a panel a reader can leave" is not a fact
 * about either of them. Both had the same gap, reported separately, and a
 * second copy of this would have been a second place to forget the capture
 * phase or the containment check.
 *
 * ─── POINTERDOWN, NOT CLICK ────────────────────────────────────────────────
 *
 * A reader who presses outside has already left; waiting for the release means
 * a press-drag-release that starts outside and ends inside leaves the panel up,
 * and it means the panel is still drawn under a pointer that is plainly
 * elsewhere. It is also what every other dismissable surface on the page does,
 * which is the whole of the founder's ask: _"au même titre que quand je
 * reclique sur le bouton"_.
 *
 * ─── AND IN THE CAPTURE PHASE ──────────────────────────────────────────────
 *
 * A bubbling listener on `document` never sees an event something in between
 * has stopped, and the panels these surfaces sit beside are other people's
 * components. Capturing costs nothing here: the handler asks only whether the
 * press landed inside the container, so running early cannot change its answer.
 *
 * ─── THE TRIGGER IS INSIDE THE CONTAINER, DELIBERATELY ─────────────────────
 *
 * Pressing the trigger of an OPEN panel must close it exactly once. The trigger
 * sits inside the ref'd container, so this handler ignores it and the trigger's
 * own toggle does the closing — where a container scoped to the panel alone
 * would close here and re-open on the trigger's toggle, leaving a control that
 * cannot be shut by the button that opened it.
 */

import { useEffect, useRef, type RefObject } from 'react'

/**
 * Bind the dismissal while `open`, and hand back the ref the caller must put on
 * the element that counts as "inside" — trigger and panel both.
 *
 * `close` is read on every press, so it must be stable across renders
 * (`useCallback`, or a setter straight off `useState`); an identity that
 * changes every render re-binds the listener every render.
 */
export function useDismissOnOutsidePointerDown<T extends HTMLElement>(
  open: boolean,
  close: () => void
): RefObject<T | null> {
  const containerRef = useRef<T | null>(null)

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event: PointerEvent) => {
      const container = containerRef.current
      // A press whose target is not a node at all (or that arrives after the
      // container has unmounted) says nothing about where the reader is.
      if (container === null || !(event.target instanceof Node)) return
      if (container.contains(event.target)) return
      close()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open, close])

  return containerRef
}
