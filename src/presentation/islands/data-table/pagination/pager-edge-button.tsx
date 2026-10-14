/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeTablePagerButtonClasses } from '@/presentation/design/table-default-classes'
import type { ReactElement } from 'react'

/** lucide's `chevrons-left` / `chevrons-right`, the glyphs of the two edge buttons. */
const GLYPH: Readonly<Record<'first' | 'last', string>> = {
  first: 'm11 17-5-5 5-5M18 17l-5-5 5-5',
  last: 'm6 17 5-5-5-5M13 17l5-5-5-5',
}

/**
 * A pager's jump to its first or last page, shadcn/ui's `DataTablePagination`
 * edge buttons: an icon button named "First page" or "Last page", disabled
 * where there is nowhere to go.
 */
export function PagerEdgeButton({
  edge,
  label,
  disabled,
  onClick,
}: {
  readonly edge: 'first' | 'last'
  readonly label: string
  readonly disabled: boolean
  readonly onClick: () => void
}): ReactElement {
  return (
    <button
      type="button"
      data-pager-edge={edge}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`${computeTablePagerButtonClasses({ disabled })} hidden px-1.5 sm:inline-flex`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="size-4"
      >
        <path d={GLYPH[edge]} />
      </svg>
    </button>
  )
}
