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
 * so `app.theme.*` overrides still win at the CSS cascade layer (`var(--sv-X)`
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

import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'
// The nav-menu trigger recipe now lives in the cross-boundary navbar recipe (so
// the navigation-menu SSR host in `ui/sections/` can render the SAME trigger
// chrome — [internal ref]). Re-exported below so `nav-menu-island.tsx` and
// the overlay-default-classes unit test keep importing it from here.
import { computeNavMenuTriggerClasses } from '@/presentation/utils/recipes/navbar-default-classes'
import { POPUP_SURFACE, RADIUS_MD } from '../recipes/shared-tokens-default-classes'

export { computeNavMenuTriggerClasses }

// ──────────────────────────────────────────────────────────────────────────────
// Shared building blocks
// ──────────────────────────────────────────────────────────────────────────────

type DialogSize = 'sm' | 'md' | 'lg' | 'xl'
type DrawerSide = 'left' | 'right' | 'top' | 'bottom'
type MenuItemVariant = 'default' | 'destructive'

/**
 * Popup tone axis for the `dropdown-menu` (`popupVariant` schema field).
 * `inverted` paints a near-black primary surface with light text so the menu
 * matches a near-black primary CTA trigger.
 */
type MenuSurface = 'default' | 'inverted'

const RADIUS_LG = `rounded-[${v('sv-radius-lg', T.radiusLg)}]`

const POPUP_SHADOW_LG = `shadow-[${v('sv-shadow-lg', T.shadowLg)}]`
const POPUP_SHADOW_XL = `shadow-[${v('sv-shadow-xl', T.shadowXl)}]`

const ENTER_EXIT_FADE_ZOOM = [
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
    RADIUS_LG,
    POPUP_SURFACE,
    POPUP_SHADOW_XL,
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
    RADIUS_LG,
    POPUP_SURFACE.replace(`border-[${v('sv-border', T.border)}]`, ALERT_DIALOG_DESTRUCTIVE_ACCENT),
    POPUP_SHADOW_XL,
    ENTER_EXIT_FADE_ZOOM,
  ].join(' ')

const DIALOG_TITLE = ['mb-2 text-lg font-semibold', `text-[${v('sv-fg', T.fg)}]`].join(' ')

/**
 * Compute the default className for the `<Dialog.Title>` heading inside a
 * dialog/alert-dialog popup. Strong foreground tone + lg size + semibold
 * weight so the title anchors the modal hierarchy.
 */
export const computeDialogTitleClasses = (): string => DIALOG_TITLE

const DIALOG_DESCRIPTION = ['mb-4 text-sm', `text-[${v('sv-fg-muted', T.fgMuted)}]`].join(' ')

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
  [DRAWER_LAYOUT_BASE, DRAWER_SIDE_MAP[side], POPUP_SURFACE, POPUP_SHADOW_XL, DRAWER_MOTION].join(
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

const POPOVER_LAYOUT = 'z-50 w-72 p-4 outline-none'

/**
 * Compute the default className for the anchored popover `<Popover.Popup>`
 * panel — the floating container that holds rich content (title +
 * description + arbitrary children). Smaller width than a dialog (`w-72`)
 * since popovers anchor to a trigger and shouldn't dominate the viewport.
 */
export const computePopoverPopupClasses = (): string =>
  [POPOVER_LAYOUT, RADIUS_LG, POPUP_SURFACE, POPUP_SHADOW_LG, ENTER_EXIT_FADE_ZOOM].join(' ')

const POPOVER_TITLE = ['mb-1 text-sm font-semibold', `text-[${v('sv-fg', T.fg)}]`].join(' ')

/**
 * Compute the default className for the `<Popover.Title>` heading. Slightly
 * smaller and less prominent than `computeDialogTitleClasses` since popovers
 * sit closer to the trigger and don't carry as much hierarchy weight.
 */
export const computePopoverTitleClasses = (): string => POPOVER_TITLE

const POPOVER_DESCRIPTION = ['mb-3 text-sm', `text-[${v('sv-fg-muted', T.fgMuted)}]`].join(' ')

/**
 * Compute the default className for the `<Popover.Description>` supporting
 * paragraph below the popover title.
 */
export const computePopoverDescriptionClasses = (): string => POPOVER_DESCRIPTION

// ──────────────────────────────────────────────────────────────────────────────
// TOOLTIP POPUP (small inverted-tone label)
// ──────────────────────────────────────────────────────────────────────────────

const TOOLTIP_LAYOUT = 'z-50 px-3 py-1.5 text-xs'

const TOOLTIP_SURFACE = [`bg-[${v('sv-fg', T.fg)}]`, `text-[${v('sv-bg', T.bg)}]`].join(' ')

const TOOLTIP_SHADOW = `shadow-[${v('sv-shadow-md', T.shadowMd)}]`

/**
 * Compute the default className for the `<Tooltip.Popup>` floating label.
 * Inverted surface (dark on light theme, light on dark theme) + xs size so
 * the tooltip reads as an auxiliary hint, distinct from popovers which carry
 * structured content. Fade-only enter/exit (no scale) keeps hover affordances
 * unobtrusive.
 */
export const computeTooltipPopupClasses = (): string =>
  [TOOLTIP_LAYOUT, RADIUS_MD, TOOLTIP_SURFACE, TOOLTIP_SHADOW, ENTER_EXIT_FADE].join(' ')

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

// ──────────────────────────────────────────────────────────────────────────────
// MENU POPUP + ITEMS (anchored dropdown menu)
// ──────────────────────────────────────────────────────────────────────────────

const MENU_POPUP_LAYOUT = 'z-50 min-w-48 py-1 outline-none'

/**
 * Inverted popup surface — near-black primary tone with light text, so a menu
 * anchored to a near-black primary CTA trigger reads as one continuous surface
 *. Keeps the `border` layout slot (transparent)
 * so the box metrics match the default (bordered) surface exactly.
 */
const MENU_POPUP_INVERTED_SURFACE = [
  'border border-transparent',
  `bg-[${v('sv-primary', T.primary)}]`,
  `text-[${v('sv-primary-fg', T.primaryFg)}]`,
].join(' ')

/**
 * Compute the default className for the `<Menu.Popup>` floating container —
 * the rounded panel that houses menu items + separators. Tighter padding
 * (`py-1`) than a popover since menu items carry their own padding row by
 * row, and `min-w-48` ensures menu items have room for labels + shortcuts
 * even when the trigger is narrow. The `variant` axis flips the surface tone:
 * `default` keeps the raised light overlay; `inverted` paints the near-black
 * primary tone so the popup matches a near-black CTA trigger.
 */
export const computeMenuPopupClasses = ({
  variant = 'default',
}: {
  variant?: MenuSurface
} = {}): string => {
  const surface = variant === 'inverted' ? MENU_POPUP_INVERTED_SURFACE : POPUP_SURFACE
  return [MENU_POPUP_LAYOUT, RADIUS_MD, surface, POPUP_SHADOW_LG, ENTER_EXIT_FADE_ZOOM].join(' ')
}

const MENU_ITEM_LAYOUT = 'flex cursor-pointer items-center px-3 py-2 text-sm outline-none'

const MENU_ITEM_DEFAULT_BASE = `text-[${v('sv-fg', T.fg)}]`

const MENU_ITEM_HIGHLIGHTED_DEFAULT = `data-[highlighted]:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`

const MENU_ITEM_DESTRUCTIVE_BASE = `text-[${v('sv-error-fg', T.errorFg)}]`

const MENU_ITEM_HIGHLIGHTED_DESTRUCTIVE = [
  `data-[highlighted]:bg-[${v('sv-error-bg', T.errorBg)}]`,
  `data-[highlighted]:text-[${v('sv-error-fg', T.errorFg)}]`,
].join(' ')

// Inverted-surface item tones — light-on-dark text with a lighter primary-hover
// highlight so items read on the near-black inverted popup surface
//.
const MENU_ITEM_INVERTED_BASE = `text-[${v('sv-primary-fg', T.primaryFg)}]`

const MENU_ITEM_HIGHLIGHTED_INVERTED = [
  `data-[highlighted]:bg-[${v('sv-primary-hover', T.primaryHover)}]`,
  `data-[highlighted]:text-[${v('sv-primary-fg', T.primaryFg)}]`,
].join(' ')

const MENU_ITEM_DISABLED = 'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50'

/**
 * Compute the default className for a single `<Menu.Item>` row inside a menu
 * popup. The `variant` axis flips the destructive (red) tone for delete-style
 * actions; `default` items use the standard foreground + subtle highlight on
 * hover/focus, `destructive` items use the error palette and light up with
 * `error-bg` on highlight so the danger reads at a glance. The `surface` axis
 * overrides the base tone to the inverted (light-on-dark) palette when the
 * popup is `inverted`, so items read on the near-black surface.
 */
export const computeMenuItemClasses = ({
  variant = 'default',
  surface = 'default',
}: {
  variant?: MenuItemVariant
  surface?: MenuSurface
} = {}): string => {
  const inverted = surface === 'inverted'
  const base = inverted
    ? MENU_ITEM_INVERTED_BASE
    : variant === 'destructive'
      ? MENU_ITEM_DESTRUCTIVE_BASE
      : MENU_ITEM_DEFAULT_BASE
  const highlighted = inverted
    ? MENU_ITEM_HIGHLIGHTED_INVERTED
    : variant === 'destructive'
      ? MENU_ITEM_HIGHLIGHTED_DESTRUCTIVE
      : MENU_ITEM_HIGHLIGHTED_DEFAULT
  return [MENU_ITEM_LAYOUT, base, highlighted, MENU_ITEM_DISABLED].join(' ')
}

const MENU_SEPARATOR = [`bg-[${v('sv-border', T.border)}]`, 'my-1 h-px'].join(' ')

/**
 * Compute the default className for a `<Menu.Separator>` between menu
 * sections. Single-pixel border-toned line with a small vertical margin so
 * sections feel grouped without taking up real estate.
 */
export const computeMenuSeparatorClasses = (): string => MENU_SEPARATOR

const MENU_TRIGGER_LAYOUT = 'px-3 py-1.5 text-sm font-medium transition-colors'

const MENU_TRIGGER_SURFACE = [
  `text-[${v('sv-fg', T.fg)}]`,
  `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `data-[open]:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
].join(' ')

/**
 * Compute the default className for a menubar top-level trigger pill. Used by
 * `menubar-island.tsx` for each `File | Edit | View | …` entry. Lights up
 * with the bg-subtle surface on hover OR when its menu is open
 * (`data-[open]`) so the active section reads at a glance.
 */
export const computeMenuTriggerClasses = (): string =>
  [MENU_TRIGGER_LAYOUT, MENU_TRIGGER_SURFACE].join(' ')

const MENUBAR_CONTAINER = [
  'flex items-center border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
].join(' ')

/**
 * Compute the default className for the menubar outer container — the
 * horizontal bar that holds the top-level menu triggers. Raised surface +
 * border so it reads as a chrome strip distinct from the page body, mirroring
 * macOS / Windows native menubars.
 */
export const computeMenubarContainerClasses = (): string => [MENUBAR_CONTAINER, RADIUS_MD].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// NAV-MENU TRIGGER — see `computeNavMenuTriggerClasses`, re-exported at the top
// of this file from `@/presentation/utils/recipes/navbar-default-classes` so the
// navigation-menu SSR host can render the SAME trigger chrome.
// ──────────────────────────────────────────────────────────────────────────────
