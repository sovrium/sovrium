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
// The nav-menu trigger recipe now lives in the cross-boundary navbar recipe (so
// the navigation-menu SSR host in `ui/sections/` can render the SAME trigger
// chrome — [internal ref]). Re-exported below so `nav-menu-island.tsx` and
// the overlay-default-classes unit test keep importing it from here.
import { computeNavMenuTriggerClasses } from '@/presentation/design/navbar-default-classes'
import { POPUP_SURFACE, RADIUS_BASE, RADIUS_MD } from '../../design/shared-tokens-default-classes'

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
const POPUP_SHADOW_MD = `shadow-[${v('shadow-md', T.shadowMd)}]`

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

// ──────────────────────────────────────────────────────────────────────────────
// MENU POPUP + ITEMS (anchored dropdown menu)
// ──────────────────────────────────────────────────────────────────────────────

const MENU_POPUP_LAYOUT = 'z-50 min-w-48 p-1 outline-none'

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
 * the rounded panel that houses menu items + separators. A uniform `p-1`
 * inset on all four sides, so each row's own 4px radius has somewhere to show
 * — a row clipped flush to the panel edge reads as a selected table row rather
 * than a pointer target. `min-w-48` ensures menu items have room for labels
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
  return [MENU_POPUP_LAYOUT, RADIUS_MD, surface, POPUP_SHADOW_MD, ENTER_EXIT_FADE_ZOOM].join(' ')
}

const MENU_ITEM_RADIUS = `rounded-[${v('radius-base', T.radiusBase)}]`

// 12px on 5px/8px padding inside a 4px-padded panel, each row clipped to its
// own 4px corner — the drawings' menu. A full-bleed highlighted row reads as a
// selected table row rather than as a pointer target.
const MENU_ITEM_LAYOUT = `flex cursor-pointer items-center gap-2 px-2 py-[5px] text-sm outline-none ${MENU_ITEM_RADIUS}`

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

// ──────────────────────────────────────────────────────────────────────────────
// MENU ITEM TOGGLE (the switch a `toggle` row draws at its right edge)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * ─── ONE RECIPE, TWO CALLERS, AND WHY IT IS ATTRIBUTE-DRIVEN ────────────────
 *
 * A toggle row is drawn twice: LIVE by `Menu.CheckboxItem` in the islands, and
 * STILL by `MenuPopupBody` in a design-system specimen. Those two cannot share
 * an element — `Menu.CheckboxItem` outside a `Menu.Root` throws — so the one
 * thing they CAN share is this class string, and it only serves both if the
 * on/off state is read off a data attribute rather than passed as a prop. Base
 * UI writes `data-checked` / `data-unchecked` onto
 * `Menu.CheckboxItemIndicator`; the drawing writes the same attribute by hand.
 * The paint then follows from one source in both places.
 *
 * The thumb carries no state of its own, so it reads the track's through a
 * NAMED group. `group/menu-toggle` rather than a bare `group`: the menu trigger
 * already carries an unnamed one for its chevron, and a bare variant here would
 * be one refactor away from resolving against it.
 *
 * The metrics are the `sm` Switch's, deliberately — `h-4 w-7` track, `h-3 w-3`
 * thumb, `translate-x-3` of travel (`toggle-default-classes.ts`). A reader who
 * met the switch on its own kit page meets the same control in a menu row, one
 * step smaller because it sits inside a text row rather than a form field.
 */
const MENU_TOGGLE_TRACK = [
  'group/menu-toggle',
  'relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border-2 border-transparent',
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  'data-[checked]:bg-primary',
  'transition-colors duration-150',
].join(' ')

/**
 * Compute the default className for the switch TRACK of a `menuitemcheckbox`
 * row — the rounded pill at the right edge. Off state takes the muted subtle
 * surface, on state fills with the canonical `bg-primary` role utility: the
 * same pair the standalone Switch uses, so the two read as one control.
 */
export const computeMenuItemToggleTrackClasses = (): string => MENU_TOGGLE_TRACK

const MENU_TOGGLE_THUMB = [
  'pointer-events-none block h-3 w-3 rounded-full',
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `shadow-[${v('shadow-sm', T.shadowSm)}]`,
  'transition-transform duration-150',
  'group-data-[checked]/menu-toggle:translate-x-3',
].join(' ')

/**
 * Compute the default className for the switch THUMB — the circle that slides
 * inside the track. Its travel is keyed on the track's own `data-checked`
 * through the named group, which is what lets one class string serve both the
 * live row and the drawn one.
 */
export const computeMenuItemToggleThumbClasses = (): string => MENU_TOGGLE_THUMB

const MENU_SEPARATOR = [`bg-[${v('sv-border', T.border)}]`, 'my-1 h-px'].join(' ')

/**
 * Compute the default className for a `<Menu.Separator>` between menu
 * sections. Single-pixel border-toned line with a small vertical margin so
 * sections feel grouped without taking up real estate.
 */
export const computeMenuSeparatorClasses = (): string => MENU_SEPARATOR

const MENU_TRIGGER_LAYOUT = 'px-3 py-1.5 text-base font-medium transition-colors'

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
