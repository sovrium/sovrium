/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable react-perf/jsx-no-new-function-as-prop --
   One frame is mounted per open cell and torn down on commit or cancel; its key
   handler closes over that cell's cancel/tab callbacks. */

import { useEffect, useRef } from 'react'
import type { FieldWriteValue } from '../../hooks/use-inline-editing'
import type { TabDirection } from '../island/tab-target'
import type { ReactElement, ReactNode } from 'react'

/**
 * The frame every inline cell editor opens in.
 *
 * It stays a DOM DESCENDANT of its `<td>`. A portal would escape the row's
 * height just as well, but the grid addresses cells by `td[data-field="…"]`
 * everywhere — the row-click guard, the focus walk, every spec — and an editor
 * that is visually over its cell while living elsewhere in the tree would be
 * outside all three. Content that must overflow the row (a candidate list, a
 * rich-text surface) is positioned absolutely INSIDE this frame instead.
 *
 * The frame owns the two keys that mean the same thing for every editor:
 *
 * - **Escape** closes without writing. Today's `SelectEditor` has no key
 *   handling at all, so Escape falls through to the browser. Putting it here is
 *   what stops each new editor from forgetting it separately.
 * - **Tab** commits and advances to the next editable column. It is intercepted
 *   rather than left to native focus movement because several of these controls
 *   swallow it — a Tiptap surface indents a list, a file input steps through its
 *   own button — and because native movement would leave the grid altogether
 *   rather than reaching the next cell.
 *
 * The frame also takes focus on mount, so that a Tab arriving from the previous
 * column lands inside the newly opened editor rather than on the document.
 */

interface EditorPopoverProps {
  readonly children: ReactNode
  readonly cancel: () => void
  /** The value Tab commits on its way out. */
  readonly tabValue: () => FieldWriteValue
  readonly tabNext?: (next: FieldWriteValue, direction: TabDirection) => void
  /** Accessible name for the frame, so the editor announces which column it edits. */
  readonly label: string
}

/** Controls a Tab arriving at the frame should hand focus to, in preference order. */
const FOCUS_TARGET_SELECTOR =
  'input:not([type="hidden"]), select, textarea, [contenteditable="true"], [tabindex="0"]'

export function EditorPopover({
  children,
  cancel,
  tabValue,
  tabNext,
  label,
}: EditorPopoverProps): ReactElement {
  const frameRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const focusable = frameRef.current?.querySelector<HTMLElement>(FOCUS_TARGET_SELECTOR)
    ;(focusable ?? frameRef.current)?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      cancel()
      return
    }
    if (e.key === 'Tab' && tabNext) {
      e.preventDefault()
      e.stopPropagation()
      tabNext(tabValue(), e.shiftKey ? 'previous' : 'next')
    }
  }

  return (
    <div
      ref={frameRef}
      role="group"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="relative w-full outline-none"
    >
      {children}
    </div>
  )
}
