/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computer for the navigation-cluster components
 *: `breadcrumb`, `pagination`, and `toc`. Schema authors who write
 * the bare `{ type: 'breadcrumb', breadcrumbItems: [...] }`,
 * `{ type: 'pagination', totalPages: 12, currentPage: 3 }`, or
 * `{ type: 'toc' }` get a complete, opinionated navigation surface —
 * subtle-foreground crumb links with chevron separators, pill page-number
 * buttons with primary-tone selected indicator, depth-driven TOC tree with
 * muted-foreground links — with zero theme-layer dependency.
 *
 * The recipe mirrors the buttons + inputs + selects + toggles + numeric +
 * date + overlays + disclosure + feedback slices (commits 02b2f35f3 +
 * 571ae53ce + 5527660bc + 000f835d7 + 386e9dc35 + 3d35fad9a + 0de6ded2a +
 * 1b3f551a7 + e7e4e4421). Layout / spacing classes (`flex items-center`,
 * `gap-2`, `px-3 py-1.5`), animation classes (`transition-colors`), and
 * pseudo-class selectors (`hover:`, `disabled:`) stay as raw Tailwind
 * utilities — they encode behavior, not color — while every color / border /
 * radius / shadow class goes through {@link withVarFallback} so
 * `app.theme.*` overrides still win at the CSS cascade layer
 * (`var(--sv-X)` resolves the override first, falling back to the inline
 * OKLCH literal).
 *
 * Subparts covered:
 *
 *   - BREADCRUMB LIST     — outer `<ol>` flex strip holding crumbs and
 *                           separators (layout-only, no chrome)
 *   - BREADCRUMB ITEM     — single crumb anchor or current-page span; state
 *                           axis `default | current` flips the foreground
 *                           tone from muted-link to strong-fg
 *   - BREADCRUMB SEPARATOR— chevron / slash divider between crumbs; subtle
 *                           foreground tone so it reads as chrome, not
 *                           content
 *   - PAGINATION LIST     — outer `<ul>` flex strip holding the prev / page-
 *                           number / ellipsis / next entries
 *   - PAGINATION BUTTON   — single page-number `<button>`; state axis
 *                           `default | selected | disabled` paints the
 *                           current page in primary tone, dim disabled
 *                           prev / next buttons, and outlines the rest as
 *                           bordered chips
 *   - PAGINATION ELLIPSIS — `…` sentinel inside an `<li>`; subtle
 *                           foreground tone so it reads as a passive gap
 *                           marker
 *   - TOC LINK            — single `<a href="#anchor">` inside the TOC
 *                           tree; state axis `default | active` toggles
 *                           between muted-foreground (idle) and strong-fg
 *                           (current section)
 *
 * Helper file lives in `src/presentation/ui/sections/renderers/element-
 * renderers/` (alongside the renderers that consume it) because all of
 * these surfaces are server-rendered as part of the SSR pass — the
 * `presentation-component → presentation-island` layer boundary does not
 * apply since this is purely a same-layer helper. Mirrors the location
 * chosen for `button-default-classes.ts`, `input-default-classes.ts`, and
 * `feedback-default-classes.ts`.
 *
 * The `nav-menu` schema (in `domain/.../navigation/navigation-menu.ts`)
 * is already prestyled via `overlay-default-classes.ts`
 * (`computeNavMenuTriggerClasses` + `computeMenuPopupClasses`) consumed by
 * `nav-menu-island.tsx` — restyled by the overlays slice (0de6ded2a). Not
 * re-covered here.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'

// ──────────────────────────────────────────────────────────────────────────────
// Shared building blocks
// ──────────────────────────────────────────────────────────────────────────────

/** Crumb state — current (last) crumb gets stronger foreground tone. */
export type BreadcrumbItemState = 'default' | 'current'

/** Page-button state — selected (current page) and disabled (boundary). */
export type PaginationButtonState = 'default' | 'selected' | 'disabled'

/** TOC link state — active (current heading) vs idle. */
export type TocLinkState = 'default' | 'active'

// ──────────────────────────────────────────────────────────────────────────────
// BREADCRUMB — list + item + separator
// ──────────────────────────────────────────────────────────────────────────────

const BREADCRUMB_LIST_LAYOUT = 'flex flex-wrap items-center gap-2 text-sm'

/**
 * Compute the default className for the breadcrumb's outer `<ol>` strip.
 * Pure layout — flex wrap so a long trail wraps to a second line, items
 * align baseline, `gap-2` separates crumb from chevron from crumb. No
 * chrome / no border — the crumbs themselves carry the tone.
 */
export const computeBreadcrumbListClasses = (): string => BREADCRUMB_LIST_LAYOUT

const BREADCRUMB_ITEM_STATE_CLASS: Record<BreadcrumbItemState, string> = {
  default: [
    `text-[${v('sv-fg-muted', T.fgMuted)}]`,
    `hover:text-[${v('sv-fg', T.fg)}]`,
    'transition-colors',
  ].join(' '),
  current: [`text-[${v('sv-fg', T.fg)}]`, 'font-medium'].join(' '),
}

/**
 * Compute the default className for a single breadcrumb crumb — either an
 * anchor link or the current-page `<span>`. The `state` axis flips between
 * muted-fg (idle link with hover lift to strong-fg) and strong-fg (current
 * page, with medium weight to read as the focal segment). Matches the
 * WAI-ARIA breadcrumb pattern where the current page is non-interactive.
 */
export const computeBreadcrumbItemClasses = ({
  state = 'default',
}: {
  state?: BreadcrumbItemState
} = {}): string => BREADCRUMB_ITEM_STATE_CLASS[state]

const BREADCRUMB_SEPARATOR_CLASS = [
  `text-[${v('sv-fg-subtle', T.fgSubtle)}]`,
  'text-sm select-none',
].join(' ')

/**
 * Compute the default className for the chevron / slash divider `<li>`
 * between crumbs. Subtle foreground tone so it reads as passive chrome
 * (the eye skips it to find the next crumb); `select-none` prevents it
 * from being copied along with the crumb text on a click-drag selection.
 */
export const computeBreadcrumbSeparatorClasses = (): string => BREADCRUMB_SEPARATOR_CLASS

// ──────────────────────────────────────────────────────────────────────────────
// PAGINATION — list + page button + ellipsis
// ──────────────────────────────────────────────────────────────────────────────

const PAGINATION_LIST_LAYOUT = 'flex items-center gap-1'

/**
 * Compute the default className for the pagination's outer `<ul>` strip.
 * Pure layout — flex row with a 1-unit gap so prev / page numbers /
 * ellipsis / next read as a tight cluster. The buttons themselves carry
 * the chrome.
 */
export const computePaginationListClasses = (): string => PAGINATION_LIST_LAYOUT

const PAGINATION_BUTTON_LAYOUT = [
  'inline-flex items-center justify-center',
  'h-9 min-w-9 px-3 text-sm font-medium',
  'transition-colors',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ')

const PAGINATION_BUTTON_RADIUS = `rounded-[${v('sv-radius-md', T.radiusMd)}]`

const PAGINATION_BUTTON_STATE_CLASS: Record<PaginationButtonState, string> = {
  default: [
    'border',
    `border-[${v('sv-border', T.border)}]`,
    `bg-[${v('sv-bg', T.bg)}]`,
    `text-[${v('sv-fg', T.fg)}]`,
    `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  ].join(' '),
  selected: [
    'border',
    `border-[${v('sv-primary', T.primary)}]`,
    `bg-[${v('sv-primary', T.primary)}]`,
    `text-[${v('sv-primary-fg', T.primaryFg)}]`,
  ].join(' '),
  disabled: [
    'border',
    `border-[${v('sv-border', T.border)}]`,
    `bg-[${v('sv-bg', T.bg)}]`,
    `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  ].join(' '),
}

/**
 * Compute the default className for a single pagination `<button>` — page-
 * number, prev, or next. The `state` axis flips the chrome:
 *   - `default`   — bordered chip on `bg` surface with hover lift to
 *                   `bg-subtle` (idle page number / enabled prev-next)
 *   - `selected`  — primary-tone fill + primary-tone border + primary-fg
 *                   text (the current page; carries `aria-current="page"`)
 *   - `disabled`  — same chrome as default but muted-fg text (combined
 *                   with the native `disabled:opacity-50` for the
 *                   boundary prev / next buttons)
 * Layout (`h-9 min-w-9 px-3`) keeps single-digit and multi-digit page
 * numbers visually consistent without making prev / next squish.
 */
export const computePaginationButtonClasses = ({
  state = 'default',
}: {
  state?: PaginationButtonState
} = {}): string =>
  [PAGINATION_BUTTON_LAYOUT, PAGINATION_BUTTON_RADIUS, PAGINATION_BUTTON_STATE_CLASS[state]].join(
    ' '
  )

const PAGINATION_ELLIPSIS_CLASS = [
  'inline-flex items-center justify-center',
  'h-9 min-w-9 px-2 text-sm',
  `text-[${v('sv-fg-subtle', T.fgSubtle)}]`,
  'select-none',
].join(' ')

/**
 * Compute the default className for the `…` sentinel `<span>` inside an
 * `<li>` between non-contiguous page numbers. Same layout dimensions as
 * a real page button so the row's height + horizontal rhythm don't
 * stutter at the gap; subtle foreground tone so the ellipsis reads as
 * passive chrome rather than an interactive control.
 */
export const computePaginationEllipsisClasses = (): string => PAGINATION_ELLIPSIS_CLASS

// ──────────────────────────────────────────────────────────────────────────────
// TOC — link state axis
// ──────────────────────────────────────────────────────────────────────────────

const TOC_LINK_LAYOUT = 'block py-0.5 text-sm transition-colors'

const TOC_LINK_STATE_CLASS: Record<TocLinkState, string> = {
  default: [`text-[${v('sv-fg-muted', T.fgMuted)}]`, `hover:text-[${v('sv-fg', T.fg)}]`].join(' '),
  active: [`text-[${v('sv-fg', T.fg)}]`, 'font-medium'].join(' '),
}

/**
 * Compute the default className for a single TOC `<a href="#anchor">`
 * link inside the table-of-contents tree. The `state` axis flips between
 * muted-fg (idle, with hover lift to strong-fg) and strong-fg + medium
 * weight (current section, when the renderer detects scroll position
 * matches the anchor). Vertical padding (`py-0.5`) keeps the click
 * target legible without burdening the dense tree's line height.
 */
export const computeTocLinkClasses = ({
  state = 'default',
}: {
  state?: TocLinkState
} = {}): string => [TOC_LINK_LAYOUT, TOC_LINK_STATE_CLASS[state]].join(' ')
