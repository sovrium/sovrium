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
 * The LAYOUT a menu trigger lays its own parts out with: its content on one
 * horizontal line, centred against the chevron {@link NavChevronDown} puts at
 * the end.
 *
 * It exists because a `<button>` is `inline-block`, and a `dropdown-menu`
 * trigger became a CONTAINER when it gained composed children. A
 * composed trigger's children routinely include a block-level element — the
 * console's operator menu stacks a name over an address in a `<div>` — and a
 * block child inside inline flow breaks the line, so the avatar, the text
 * column and the chevron each landed on a row of their own. Nothing in the
 * class list said otherwise: the trigger carried `group` plus whatever the
 * author wrote, and no display at all.
 *
 * Authored classes are appended AFTER this by both consumers, so an author who
 * wants something else still wins at the cascade — `justify-center` for a
 * narrow rail is the case that made this visible, since it is inert on an
 * inline-block box and correct the moment the trigger is a flex row.
 *
 * Both paints import it. They must agree byte for byte or the trigger reflows
 * when the island mounts, which is the same contract {@link NavChevronDown}
 * is here for.
 */
export const MENU_TRIGGER_LAYOUT_CLASSES = 'inline-flex items-center gap-2'

/**
 * The layout of the WRAPPER a composed trigger's children are re-hydrated
 * into. {@link MENU_TRIGGER_LAYOUT_CLASSES} lays out the trigger's own parts —
 * the content and the chevron — but the composed children arrive inside a
 * single `<span>`, and a bare `<span>` is inline, so without this they keep
 * stacking one rung further in: the outer row reads as content-then-chevron
 * while the content itself is still three lines tall.
 *
 * `flex-1` is what puts the chevron at the far end rather than immediately
 * after the content, which is how the console's operator menu is drawn — the
 * LABEL trigger is drawn the other way, a pill with its chevron adjacent, and
 * keeps its wrapper-less path. `min-w-0` lets a long address truncate instead
 * of forcing the trigger wider than the rail that holds it.
 */
export const MENU_TRIGGER_CONTENT_CLASSES = 'flex min-w-0 flex-1 items-center gap-2'

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
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="transition-transform group-data-[popup-open]:rotate-180"
    >
      <path
        d="M4 6l4 4 4-4"
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
