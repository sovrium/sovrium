/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Shared open/close + outside-click + optional Escape state for the
 * plain-`<div>` dropdowns used by the data-table toolbar (PG-03).
 *
 * Both `group-menu.tsx` and `views-menu.tsx` deliberately render a plain-`<div>`
 * dropdown (NOT a Base UI Menu) for the same Playwright-actionability reason:
 * users immediately click ANOTHER UI element after picking a value, and Base
 * UI Menu's anchored Portal lingers briefly with `inert=true` after close. See
 * the rationale comments at the top of those files for the full story.
 *
 * The shared `mousedown` outside-click listener and the toggle/open/close
 * callbacks duplicated across the two sibling menus are extracted here so
 * future menu surfaces (Cycle 6+ filter/sort affordances, etc.) don't keep
 * accreting copies.
 *
 * Stays in `src/presentation/islands/data-table/island/` because both consumers
 * live here and the hook is meaningfully coupled to the toolbar's actionability
 * contract; lifting it to `_shared/` would untether it from the call-site
 * rationale.
 *
 * **Cycle 5 audit (refactor):** extracted at the N=2 inflection point after
 * Cycle 4 introduced the first plain-`<div>` dropdown (group-menu) and Cycle 5
 * added the second (views-menu). The earlier auditor memo's `Menu-pattern N=3`
 * trigger now resolves at N=2 — earlier than projected because views-menu's
 * Escape-key handler made the duplication slightly larger than group-menu's
 * mousedown-only handler.
 */
export interface DropdownStateOptions {
  /**
   * Whether to close on the Escape key. Defaults to false (matching group-menu's
   * original behaviour). The views-menu opts in to keyboard parity with the
   * Base UI Menu it could otherwise have used.
   */
  readonly closeOnEscape?: boolean
}

export interface DropdownState {
  readonly open: boolean
  readonly rootRef: React.RefObject<HTMLDivElement | null>
  readonly onToggle: () => void
  readonly close: () => void
}

/**
 * Wire a plain-`<div>` dropdown's open/close state with outside-click + (optional)
 * Escape-key dismissal. Attach `rootRef` to the dropdown's root `<div>` and
 * spread `onToggle` onto the trigger button; render the dropdown body
 * conditionally on `open`. Callers handle their own item-click closing via the
 * returned `close` callback.
 *
 * Listens on `mousedown` (not `click`) so a follow-up `click` on another DOM
 * element fires AFTER the menu has already closed — required for the
 * Playwright actionability semantics specs depend on.
 */
export function useDropdownState(options: DropdownStateOptions = {}): DropdownState {
  const { closeOnEscape = false } = options
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const onToggle = useCallback(() => setOpen((prev) => !prev), [])
  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return undefined
    const onDocMouseDown = (event: MouseEvent) => {
      const { target } = event
      if (target instanceof Node && rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false)
      }
    }
    const onKeyDown = closeOnEscape
      ? (event: KeyboardEvent) => {
          if (event.key === 'Escape') setOpen(false)
        }
      : undefined
    document.addEventListener('mousedown', onDocMouseDown)
    if (onKeyDown) document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      if (onKeyDown) document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, closeOnEscape])

  return { open, rootRef, onToggle, close }
}

/**
 * Tailwind class string shared by all plain-`<div>` dropdown trigger buttons in
 * the data-table toolbar. Co-located with {@link useDropdownState} so a future
 * pass adding a new dropdown picks up both the behaviour and the visual
 * consistency in one import.
 */
export const DROPDOWN_TRIGGER_CLASS = 'hover:bg-background-subtle rounded border px-3 py-1 text-sm'
