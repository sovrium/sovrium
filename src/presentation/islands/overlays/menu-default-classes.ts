/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui dropdown-menu, context-menu and menubar (https://ui.shadcn.com), registry commit 3464245c4513.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

import { cva } from 'class-variance-authority'
import {
  MENU_CONTENT_FRAME,
  MENU_CONTENT_SURFACE as POPOVER_SURFACE,
  MENU_ITEM_FRAME,
} from '@/presentation/design/dropdown-menu-default-classes'
import type { MenuKind } from './menu-slot-context'

/**
 * The menu family's anatomy, as base-nova draws it: the content panel, its
 * items, separators and shortcuts, the menubar and its triggers — shared by
 * `dropdown-menu`, `context-menu` and `menubar`, whose base-nova sources draw
 * the same rows and differ only in the panel's minimum width.
 *
 * Two Sovrium additions sit in the same anatomy rather than beside it:
 *
 * - `popupVariant: inverted` paints the panel in the primary colour, so a menu
 *   opened from a primary button reads as one surface with it;
 * - a `toggle` row draws a small switch at its right edge, in the switch's own
 *   colours (`bg-input` off, `bg-primary` on, a `bg-background` thumb).
 *
 * One deliberate difference: base-nova sizes a dropdown's panel to its trigger
 * (`w-(--anchor-width)`) and leaves the width to the caller. Sovrium has no
 * width key for a menu, and a menu opened from an icon would wrap its labels,
 * so the panel sizes to its rows from the minimum width up.
 *
 * Strings are base-nova's own, minus the `cn-*` style hooks the shadcn CLI
 * rewrites at install time.
 */

/** Popup tone axis for the `dropdown-menu` (`popupVariant` schema field). */
type MenuSurface = 'default' | 'inverted'

type MenuItemVariant = 'default' | 'destructive'

const MENU_CONTENT_SURFACE: Record<MenuSurface, string> = {
  default: POPOVER_SURFACE,
  inverted: 'bg-primary text-primary-foreground ring-1 ring-primary',
}

/** base-nova's minimum panel width per menu. */
const MENU_CONTENT_MIN_WIDTH: Record<MenuKind, string> = {
  'dropdown-menu': 'min-w-32',
  'context-menu': 'min-w-36',
  menubar: 'min-w-36',
}

/**
 * The `*-content` panel: anchored, growing out of its trigger, outlined by a
 * 1px foreground ring at 10 % (no border).
 */
export const computeMenuPopupClasses = ({
  variant = 'default',
  kind = 'dropdown-menu',
}: {
  variant?: MenuSurface
  kind?: MenuKind
} = {}): string =>
  [MENU_CONTENT_FRAME, MENU_CONTENT_MIN_WIDTH[kind], MENU_CONTENT_SURFACE[variant]].join(' ')

/** The row's tone at rest and when highlighted (pointer or keyboard). */
const MENU_ITEM_TONE = cva('', {
  variants: {
    surface: { default: '', inverted: '' },
    variant: { default: '', destructive: '' },
  },
  compoundVariants: [
    {
      surface: 'default',
      variant: 'default',
      className:
        'focus:bg-accent focus:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground',
    },
    {
      surface: 'default',
      variant: 'destructive',
      className:
        'text-destructive focus:bg-destructive/10 focus:text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive dark:focus:bg-destructive/20 dark:data-highlighted:bg-destructive/20 *:[svg]:text-destructive',
    },
    {
      surface: 'inverted',
      className:
        'text-primary-foreground focus:bg-primary-foreground/10 data-highlighted:bg-primary-foreground/10',
    },
  ],
})

/**
 * A `*-item` row. The `variant` axis is base-nova's `default | destructive`
 * (the row also carries `data-variant`); the `surface` axis re-tones the row
 * for an inverted panel.
 */
export const computeMenuItemClasses = ({
  variant = 'default',
  surface = 'default',
}: {
  variant?: MenuItemVariant
  surface?: MenuSurface
} = {}): string => `${MENU_ITEM_FRAME} ${MENU_ITEM_TONE({ surface, variant })}`

/** `*-shortcut`: the key hint at the row's end. */
const MENU_SHORTCUT = 'ml-auto text-xs tracking-widest text-muted-foreground'

/** The key hint a row shows at its end. */
export const computeMenuShortcutClasses = (): string => MENU_SHORTCUT

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
 *
 * The thumb reads the track's state through a NAMED group, `group/menu-toggle`,
 * so it can never resolve against another group on the row. The metrics are
 * the small switch's: an `h-4 w-7` track, a `size-3` thumb.
 */
const MENU_TOGGLE_TRACK =
  'group/menu-toggle relative ml-auto inline-flex h-4 w-7 shrink-0 items-center rounded-full border border-transparent bg-input transition-all data-[checked]:bg-primary dark:bg-input/80 dark:data-[checked]:bg-primary'

/** The switch track at the right edge of a toggle row. */
export const computeMenuItemToggleTrackClasses = (): string => MENU_TOGGLE_TRACK

const MENU_TOGGLE_THUMB =
  'pointer-events-none block size-3 rounded-full bg-background ring-0 transition-transform group-data-[checked]/menu-toggle:translate-x-[calc(100%+2px)] dark:group-data-[checked]/menu-toggle:bg-primary-foreground dark:group-data-[unchecked]/menu-toggle:bg-foreground'

/** The thumb sliding inside the toggle row's track. */
export const computeMenuItemToggleThumbClasses = (): string => MENU_TOGGLE_THUMB

/** `*-separator`: a hairline in the border colour, bled to the panel's padding. */
const MENU_SEPARATOR = '-mx-1 my-1 h-px bg-border'

/** The line between two groups of rows. */
export const computeMenuSeparatorClasses = (): string => MENU_SEPARATOR

/** `menubar-trigger`: a compact pill, muted while hovered or open. */
const MENUBAR_TRIGGER =
  'flex items-center rounded-sm px-1.5 py-[2px] text-sm font-medium outline-hidden select-none hover:bg-muted aria-expanded:bg-muted'

/** A menubar's top-level trigger (`File`, `Edit`, …). */
export const computeMenuTriggerClasses = (): string => MENUBAR_TRIGGER

/** `menubar`: the bordered strip holding the triggers. */
const MENUBAR = 'flex h-8 items-center gap-0.5 rounded-lg border p-[3px]'

/** The menubar's outer strip. */
export const computeMenubarContainerClasses = (): string => MENUBAR

/** `*-label`: a group heading inside a menu (base-nova's `DropdownMenuLabel`). */
export const computeMenuLabelClasses = (): string =>
  'px-1.5 py-1 text-xs font-medium text-muted-foreground'

/** `*-radio-item-indicator`: the check at the end of the chosen radio row. */
export const computeMenuRadioIndicatorClasses = (): string =>
  'pointer-events-none absolute right-2 flex items-center justify-center'
