/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeBadgeClasses, type BadgeVariant } from './badge-default-classes'
import type { ReactElement } from 'react'

/**
 * A small shadcn/ui badge beside a navigation-menu entry's label ("New",
 * "Beta"). Same element in the SSR placeholder and the hydrated island.
 *
 * Its own module rather than a member of `nav-menu-parts.tsx`: the menu
 * islands read that file for the chevron alone, and must not pay for the
 * badge recipe to mount.
 */
export function NavItemBadge({
  text,
  variant,
}: {
  readonly text: string
  readonly variant?: BadgeVariant
}): ReactElement {
  return (
    <span
      data-slot="badge"
      data-variant={variant ?? 'default'}
      className={computeBadgeClasses({ variant })}
    >
      {text}
    </span>
  )
}
