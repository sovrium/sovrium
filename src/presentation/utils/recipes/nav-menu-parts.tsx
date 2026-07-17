/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { computeBadgeClasses, type BadgeVariant } from './navbar-default-classes'
import type { ReactElement } from 'react'

export function NavChevronDown(): ReactElement {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className="transition-transform group-data-[popup-open]:rotate-180"
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function NavItemBadge({
  text,
  variant,
}: {
  readonly text: string
  readonly variant?: BadgeVariant
}): ReactElement {
  return <span className={computeBadgeClasses({ variant })}>{text}</span>
}
