/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui checkbox (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

import { useEffect, useRef, type InputHTMLAttributes, type ReactElement } from 'react'
import {
  computeTableCheckboxControlClasses,
  computeTableCheckboxIndicatorClasses,
} from '@/presentation/design/table-default-classes'

/** lucide's `check`, the mark of a ticked box. */
const CHECK = <path d="M20 6 9 17l-5-5" />

/** lucide's `minus`, the mark of a partly ticked box. */
const MINUS = <path d="M5 12h14" />

/**
 * A grid checkbox on shadcn's `Checkbox` anatomy — a box (`data-slot=checkbox`)
 * and its mark (`checkbox-indicator`) — kept a native `<input type=checkbox>`
 * underneath, so it is ticked, labelled and submitted as a checkbox always has
 * been. `indeterminate` is the DOM property, so the box also reads as mixed.
 */
export function GridCheckbox({
  indeterminate = false,
  interactive = false,
  ...input
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> & {
  readonly indeterminate?: boolean
  readonly interactive?: boolean
}): ReactElement {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <span
      data-slot="checkbox"
      className="relative inline-flex size-4 shrink-0 align-middle"
    >
      <input
        ref={ref}
        type="checkbox"
        {...input}
        className={computeTableCheckboxControlClasses({ interactive })}
      />
      <span
        aria-hidden="true"
        data-slot="checkbox-indicator"
        className={computeTableCheckboxIndicatorClasses()}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {indeterminate ? MINUS : CHECK}
        </svg>
      </span>
    </span>
  )
}
