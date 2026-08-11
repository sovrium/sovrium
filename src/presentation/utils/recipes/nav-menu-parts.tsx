/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared navbar sub-parts rendered IDENTICALLY by the SSR placeholders
 * (`ui/sections/…`) and the hydrated islands (`islands/…`).
 *
 * Both surfaces live on opposite sides of the `presentation-component` ↔
 * `presentation-island` boundary and cannot import each other, so these tiny
 * presentational helpers live in `presentation/utils` (importable by both). One
 * shared chevron + one shared badge pill keeps the SSR markup and the hydrated
 * markup byte-identical, so no new affordance flashes in / no box reflows when
 * the island mounts.
 */

import { computeBadgeClasses, type BadgeVariant } from './navbar-default-classes'
import type { ReactElement } from 'react'

/**
 * The down-chevron affordance shown next to a menu/nav trigger that opens a
 * popup. Rendered the SAME way in the SSR placeholder and the hydrated island
 * so the indicator is present on first paint and never flashes in on hydration.
 */
export function NavChevronDown(): ReactElement {
  // [internal ref] (round-4, [internal ref]): no
  // hardcoded color — the chevron inherits `currentColor` from the trigger text.
  // `transition-transform group-data-[popup-open]:rotate-180` flips the chevron
  // when the enclosing `group` trigger's menu is open (Base UI stamps
  // `data-popup-open` on the open `Menu.Trigger`). Shared by both islands + both
  // SSR placeholders; the trigger carries the `group` marker (via
  // `computeNavMenuTriggerClasses` for nav-menu, or an explicit `group` for the
  // dropdown-menu label trigger). These literal classes are captured by the
  // `@tailwindcss/oxide` scan into `BUILTIN_CSS_CANDIDATES` (generated-css-assets.ts),
  // so no `arbitrary-var-safelist.ts` entry is needed (that safelist only covers
  // `v('sv-X', T.Y)` template-literal arbitrary values in `*-default-classes.ts`).
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

/**
 * A small pill rendered next to a navigation item's label (e.g. "New", "Beta"),
 * reusing the shared badge variant tones via {@link computeBadgeClasses}. Same
 * element in the SSR placeholder and the hydrated island.
 */
export function NavItemBadge({
  text,
  variant,
}: {
  readonly text: string
  readonly variant?: BadgeVariant
}): ReactElement {
  return <span className={computeBadgeClasses({ variant })}>{text}</span>
}
