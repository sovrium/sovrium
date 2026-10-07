/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'
import { POPUP_SURFACE, RADIUS_MD } from '../../design/shared-tokens-default-classes'
import { POPUP_SHADOW_MD, ENTER_EXIT_FADE_ZOOM } from './overlay-default-classes'

/**
 * Default classes for the menu family: the popup, its items in their three
 * surfaces, the toggle item's track and thumb, separators, the trigger and the
 * menubar.
 */

type MenuItemVariant = 'default' | 'destructive'

/**
 * Popup tone axis for the `dropdown-menu` (`popupVariant` schema field).
 * `inverted` paints a near-black primary surface with light text so the menu
 * matches a near-black primary CTA trigger.
 */
type MenuSurface = 'default' | 'inverted'

// ──────────────────────────────────────────────────────────────────────────────
// MENU POPUP + ITEMS (anchored dropdown menu)
// ──────────────────────────────────────────────────────────────────────────────

const MENU_POPUP_LAYOUT = 'z-50 min-w-48 p-1 outline-none'

/**
 * Inverted popup surface — near-black primary tone with light text, so a menu
 * anchored to a near-black primary CTA trigger reads as one continuous surface
 * — and keeps the `border` layout slot (transparent)
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
// highlight so items read on the near-black inverted popup surface.
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
