/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computer for the overlay components.
 *
 * Schema authors who write bare `{ type: 'dialog' }`, `{ type: 'drawer' }`,
 * `{ type: 'popover' }`, `{ type: 'tooltip' }`, `{ type: 'hover-card' }`,
 * `{ type: 'dropdown-menu' }`, or the menubar/nav-menu schemas get a complete,
 * opinionated floating surface — elevated background, refined border, scrim
 * backdrop where applicable, animated enter/exit keyframes, and Base UI
 * state-driven highlighting — with zero theme-layer dependency.
 *
 * The recipe mirrors the buttons + inputs + selects + toggles + numeric + date
 * slices (commits 02b2f35f3 + 571ae53ce + 5527660bc + 000f835d7 + 386e9dc35 +
 * 3d35fad9a): layout / spacing / animation classes (`fixed inset-0 z-50`,
 * `data-[starting-style]:opacity-0`, `transition-all duration-200`) stay as raw
 * Tailwind utilities — they encode the popup behavior, not color — while every
 * color / border / shadow / radius class goes through {@link withVarFallback}
 * so `app.design.*` overrides still win at the CSS cascade layer (`var(--sv-X)`
 * resolves the override first, falling back to the inline OKLCH literal).
 *
 * Subparts covered (matches the existing DOM layering across the 8 overlay
 * islands: `dialog-island.tsx`, `drawer-island.tsx`, `popover-island.tsx`,
 * `tooltip-island.tsx`, `hover-card-island.tsx`, `menu-island.tsx`,
 * `menubar-island.tsx`, `nav-menu-island.tsx`):
 *
 *   - BACKDROP     — full-page scrim layered under modal/alert/drawer popups
 *   - DIALOG POPUP — centered modal container (alert-dialog reuses with `variant`)
 *   - DRAWER POPUP — side-anchored slide-in panel (`side` axis: left/right/top/bottom)
 *   - POPOVER POPUP — anchored floating panel for inline rich content
 *   - TOOLTIP POPUP — small inverted-tone label for hover hints
 *   - HOVER-CARD POPUP — popover variant for hover-triggered link previews
 *   - MENU POPUP   — anchored menu container holding items + separators
 *   - MENU ITEM    — single row inside a menu (`variant`: default | destructive)
 *   - MENU ITEM TOGGLE — the switch a `toggle` row draws at its right edge
 *   - MENU TRIGGER — menubar trigger pill (top-level menubar entries)
 *   - MENU SEPARATOR — divider between menu sections
 *
 * Helper file lives in `src/presentation/islands/` (alongside the islands that
 * consume it) because overlays hydrate entirely client-side via the island
 * registry — the `presentation-component → presentation-island` layer boundary
 * disallows island imports from `ui/sections/`. Mirrors the location chosen
 * for `select-default-classes.ts`, `toggle-default-classes.ts`,
 * `numeric-default-classes.ts`, and `date-default-classes.ts`.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'
import { computeNavMenuTriggerClasses } from '@/presentation/design/navbar-default-classes'
import { POPUP_SURFACE, RADIUS_BASE, RADIUS_MD } from '../../design/shared-tokens-default-classes'

export { computeNavMenuTriggerClasses }

// ──────────────────────────────────────────────────────────────────────────────
// Shared building blocks
// ──────────────────────────────────────────────────────────────────────────────

type DialogSize = 'sm' | 'md' | 'lg' | 'xl'
type DrawerSide = 'left' | 'right' | 'top' | 'bottom'

/**
 * ─── WHICH RADIUS A FLOATING SURFACE TAKES ─────────────────────────────────
 *
 * The scale has three working steps and the reference assigns them by KIND, not
 * by size: `base` (4px) for controls — a button, a field, a menu item, a tooltip
 * chip; `md` (6px) for popups — a menu, a popover, a dialog, a drawer; `lg`
 * (8px) for regions, meaning a card or a section of a page.
 *
 * Nothing in this file is a region, so `lg` does not appear in it. A dialog is a
 * popup that happens to be large; at 8px it read as a region that had come
 * loose from the page rather than as a surface floating above one.
 */

/**
 * The DEEPER of two floating planes: a dialog or a drawer, which is detached
 * from the page and dims what is behind it.
 *
 * There are two planes, not one. Menus and popovers moved down to
 * `POPUP_SHADOW_MD` because they are ANCHORED — each points at the control that
 * opened it, so it sits a short distance off the page rather than on a plane of
 * its own. A dialog points at nothing, which is what earns it this step.
 *
 * The plane above this one stays retired: nothing in the system renders above a
 * dialog, and a depth scale is only readable when something occupies each step.
 * A depth scale is only readable when something occupies each step; a top
 * step with no neighbour above it conveys no ordering, it just casts a
 * heavier shadow. One plane, one shadow.
 */
const POPUP_SHADOW_LG = `shadow-[${v('shadow-lg', T.shadowLg)}]`

/**
 * The step below it, for a surface anchored to the control that opened it.
 *
 * A popover is not a dialog: it points at something, so it sits a short
 * distance off the page rather than on a plane of its own. The drawings put
 * menus and popovers here and reserve `lg` for a dialog or a drawer, which is
 * detached from everything and dims what is behind it.
 */
export const POPUP_SHADOW_MD = `shadow-[${v('shadow-md', T.shadowMd)}]`

export const ENTER_EXIT_FADE_ZOOM = [
  'transition-all',
  'duration-200',
  'data-[starting-style]:scale-95',
  'data-[starting-style]:opacity-0',
  'data-[ending-style]:scale-95',
  'data-[ending-style]:opacity-0',
].join(' ')

const ENTER_EXIT_FADE = [
  'transition-opacity',
  'duration-200',
  'data-[starting-style]:opacity-0',
  'data-[ending-style]:opacity-0',
].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// BACKDROP (shared by dialog / alert-dialog / drawer)
// ──────────────────────────────────────────────────────────────────────────────

const BACKDROP_LAYOUT = 'fixed inset-0 z-40'

const BACKDROP_SURFACE = `bg-[${v('sv-scrim', T.scrim)}]/50`

/**
 * Compute the default className for the full-page scrim backdrop behind modal
 * dialogs, alert-dialogs, and drawers. Uses the scrim role at 50% opacity so
 * underlying page content stays partially visible, signaling "context preserved
 * while modal is open". Fade-only enter/exit (no scale) since backdrops have no
 * focal point to scale from.
 */
export const computeOverlayBackdropClasses = (): string =>
  [BACKDROP_LAYOUT, BACKDROP_SURFACE, ENTER_EXIT_FADE].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// DIALOG POPUP (centered modal)
// ──────────────────────────────────────────────────────────────────────────────

const DIALOG_LAYOUT_BASE =
  'fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 p-6 outline-none'

const DIALOG_SIZE_MAP: Record<DialogSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
}

/**
 * Compute the default className for the centered-modal `<Dialog.Popup>` body
 * — a viewport-centered container with elevation, rounded corners, and an
 * animated enter/exit (fade + subtle zoom). The `size` axis caps width at
 * `sm | md | lg | xl` (defaults to `md`) so the dialog scales with content
 * importance without ever pushing past the viewport edge on mid-density
 * screens.
 */
export const computeDialogPopupClasses = ({
  size = 'md',
}: {
  size?: DialogSize
} = {}): string =>
  [
    DIALOG_LAYOUT_BASE,
    DIALOG_SIZE_MAP[size],
    RADIUS_MD,
    POPUP_SURFACE,
    POPUP_SHADOW_LG,
    ENTER_EXIT_FADE_ZOOM,
  ].join(' ')

const ALERT_DIALOG_DESTRUCTIVE_ACCENT = [`border-[${v('sv-error-border', T.errorBorder)}]`].join(
  ' '
)

/**
 * Compute the default className for the alert-dialog `<Dialog.Popup>` body.
 * Same shape and elevation as a regular dialog but with the error-border tone
 * so the destructive intent reads at a glance even before the user reads the
 * title. Cancel + Confirm buttons inside are styled by `computeButtonClasses`
 * (variant: `destructive`) — this helper governs only the surface chrome.
 */
export const computeAlertDialogPopupClasses = ({
  size = 'md',
}: {
  size?: DialogSize
} = {}): string =>
  [
    DIALOG_LAYOUT_BASE,
    DIALOG_SIZE_MAP[size],
    RADIUS_MD,
    POPUP_SURFACE.replace(`border-[${v('sv-border', T.border)}]`, ALERT_DIALOG_DESTRUCTIVE_ACCENT),
    POPUP_SHADOW_LG,
    ENTER_EXIT_FADE_ZOOM,
  ].join(' ')

const DIALOG_TITLE = ['mb-2 text-lg font-semibold', `text-[${v('sv-fg', T.fg)}]`].join(' ')

/**
 * Compute the default className for the `<Dialog.Title>` heading inside a
 * dialog/alert-dialog popup. Strong foreground tone + lg size + semibold
 * weight so the title anchors the modal hierarchy.
 */
export const computeDialogTitleClasses = (): string => DIALOG_TITLE

const DIALOG_DESCRIPTION = ['mb-4 text-base', `text-[${v('sv-fg-muted', T.fgMuted)}]`].join(' ')

/**
 * Compute the default className for the `<Dialog.Description>` supporting
 * paragraph below the title. Muted foreground tone so it reads as context,
 * not as the primary affordance.
 */
export const computeDialogDescriptionClasses = (): string => DIALOG_DESCRIPTION

const DIALOG_ACTIONS = 'flex justify-end gap-3'

/**
 * Compute the default className for the action-row container at the bottom of
 * a dialog (Cancel + Confirm buttons). Pure layout — buttons inside carry
 * their own variant-driven className via `computeButtonClasses`.
 */
export const computeDialogActionsClasses = (): string => DIALOG_ACTIONS

// ──────────────────────────────────────────────────────────────────────────────
// DRAWER POPUP (side-anchored slide-in panel)
// ──────────────────────────────────────────────────────────────────────────────

const DRAWER_LAYOUT_BASE = 'fixed z-50 outline-none'

const DRAWER_SIDE_MAP: Record<DrawerSide, string> = {
  left: 'inset-y-0 left-0',
  right: 'inset-y-0 right-0',
  top: 'inset-x-0 top-0',
  bottom: 'inset-x-0 bottom-0',
} as const

const DRAWER_MOTION =
  'transition-transform duration-300 data-[starting-style]:translate-x-0 data-[ending-style]:translate-x-0'

/**
 * Compute the default className for the slide-in drawer `<Dialog.Popup>` body.
 * The `side` axis anchors the panel to one viewport edge (left / right / top /
 * bottom); the calling island composes the slide-in/out keyframes via the
 * side-specific `data-[starting-style]:translate-*` classes it already owns
 * (those vary per side and stay in the island file). This helper governs the
 * surface chrome (background, border, shadow) plus the shared layout.
 */
export const computeDrawerPopupClasses = ({
  side = 'right',
}: {
  side?: DrawerSide
} = {}): string =>
  [DRAWER_LAYOUT_BASE, DRAWER_SIDE_MAP[side], POPUP_SURFACE, POPUP_SHADOW_LG, DRAWER_MOTION].join(
    ' '
  )

const DRAWER_HEADER = ['border-b p-4', `border-[${v('sv-border', T.border)}]`].join(' ')

/**
 * Compute the default className for the drawer header band — the strip that
 * holds the title + description above the scrollable body. A bottom border
 * separates it from the body content so the title stays anchored as the body
 * scrolls.
 */
export const computeDrawerHeaderClasses = (): string => DRAWER_HEADER

// ──────────────────────────────────────────────────────────────────────────────
// POPOVER POPUP (anchored floating rich content)
// ──────────────────────────────────────────────────────────────────────────────

const POPOVER_LAYOUT = 'z-50 w-72 p-2 outline-none'

/**
 * Compute the default className for the anchored popover `<Popover.Popup>`
 * panel — the floating container that holds rich content (title +
 * description + arbitrary children). Smaller width than a dialog (`w-72`)
 * since popovers anchor to a trigger and shouldn't dominate the viewport.
 */
export const computePopoverPopupClasses = (): string =>
  [POPOVER_LAYOUT, RADIUS_MD, POPUP_SURFACE, POPUP_SHADOW_MD, ENTER_EXIT_FADE_ZOOM].join(' ')

const POPOVER_TITLE = ['mb-1 px-1 text-base font-semibold', `text-[${v('sv-fg', T.fg)}]`].join(' ')

/**
 * Compute the default className for the `<Popover.Title>` heading. Slightly
 * smaller and less prominent than `computeDialogTitleClasses` since popovers
 * sit closer to the trigger and don't carry as much hierarchy weight.
 */
export const computePopoverTitleClasses = (): string => POPOVER_TITLE

const POPOVER_DESCRIPTION = ['mb-2 px-1 text-sm', `text-[${v('sv-fg-muted', T.fgMuted)}]`].join(' ')

/**
 * Compute the default className for the `<Popover.Description>` supporting
 * paragraph below the popover title.
 */
export const computePopoverDescriptionClasses = (): string => POPOVER_DESCRIPTION

// ──────────────────────────────────────────────────────────────────────────────
// TOOLTIP POPUP (small inverted-tone label)
// ──────────────────────────────────────────────────────────────────────────────

// A chip at the control step: 4px, not the 6px a panel takes, and padded like a
// badge rather than like a button. It is the smallest surface in the system and
// was rendering a third larger than the reference draws it.
const TOOLTIP_LAYOUT = 'z-50 px-2 py-1 text-xs'

const TOOLTIP_SURFACE = [`bg-[${v('sv-fg', T.fg)}]`, `text-[${v('sv-bg', T.bg)}]`].join(' ')

// A tooltip is an INK CHIP, not a panel. It reads as floating because it is
// the inverse of everything around it; a shadow under a near-black chip is
// invisible work. The drawings give it none.
const TOOLTIP_SHADOW = ''

/**
 * Compute the default className for the `<Tooltip.Popup>` floating label.
 * Inverted surface (dark on light theme, light on dark theme) + xs size so
 * the tooltip reads as an auxiliary hint, distinct from popovers which carry
 * structured content. Fade-only enter/exit (no scale) keeps hover affordances
 * unobtrusive.
 */
export const computeTooltipPopupClasses = (): string =>
  [TOOLTIP_LAYOUT, RADIUS_BASE, TOOLTIP_SURFACE, TOOLTIP_SHADOW, ENTER_EXIT_FADE].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// HOVER-CARD POPUP (popover-like, hover-triggered)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for the `<PreviewCard.Popup>` floating panel.
 * Identical recipe to `computePopoverPopupClasses` since hover-cards are
 * functionally a hover-triggered popover. Exposed as a sibling helper so a
 * future redesign can fork the recipes (e.g. richer media chrome for
 * hover-cards) without touching popover styling.
 */
export const computeHoverCardPopupClasses = (): string => computePopoverPopupClasses()
