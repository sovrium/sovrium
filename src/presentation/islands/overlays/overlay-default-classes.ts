/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'
import { computeNavMenuTriggerClasses } from '@/presentation/utils/recipes/navbar-default-classes'
import { POPUP_SURFACE, RADIUS_MD } from '../recipes/shared-tokens-default-classes'

export { computeNavMenuTriggerClasses }


type DialogSize = 'sm' | 'md' | 'lg' | 'xl'
type DrawerSide = 'left' | 'right' | 'top' | 'bottom'
type MenuItemVariant = 'default' | 'destructive'

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


const BACKDROP_LAYOUT = 'fixed inset-0 z-40'

const BACKDROP_SURFACE = `bg-[${v('sv-scrim', T.scrim)}]/50`

export const computeOverlayBackdropClasses = (): string =>
  [BACKDROP_LAYOUT, BACKDROP_SURFACE, ENTER_EXIT_FADE].join(' ')


const DIALOG_LAYOUT_BASE =
  'fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 p-6 outline-none'

const DIALOG_SIZE_MAP: Record<DialogSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
}

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

export const computeDialogTitleClasses = (): string => DIALOG_TITLE

const DIALOG_DESCRIPTION = ['mb-4 text-sm', `text-[${v('sv-fg-muted', T.fgMuted)}]`].join(' ')

export const computeDialogDescriptionClasses = (): string => DIALOG_DESCRIPTION

const DIALOG_ACTIONS = 'flex justify-end gap-3'

export const computeDialogActionsClasses = (): string => DIALOG_ACTIONS


const DRAWER_LAYOUT_BASE = 'fixed z-50 outline-none'

const DRAWER_SIDE_MAP: Record<DrawerSide, string> = {
  left: 'inset-y-0 left-0',
  right: 'inset-y-0 right-0',
  top: 'inset-x-0 top-0',
  bottom: 'inset-x-0 bottom-0',
} as const

const DRAWER_MOTION =
  'transition-transform duration-300 data-[starting-style]:translate-x-0 data-[ending-style]:translate-x-0'

export const computeDrawerPopupClasses = ({
  side = 'right',
}: {
  side?: DrawerSide
} = {}): string =>
  [DRAWER_LAYOUT_BASE, DRAWER_SIDE_MAP[side], POPUP_SURFACE, POPUP_SHADOW_XL, DRAWER_MOTION].join(
    ' '
  )

const DRAWER_HEADER = ['border-b p-4', `border-[${v('sv-border', T.border)}]`].join(' ')

export const computeDrawerHeaderClasses = (): string => DRAWER_HEADER


const POPOVER_LAYOUT = 'z-50 w-72 p-4 outline-none'

export const computePopoverPopupClasses = (): string =>
  [POPOVER_LAYOUT, RADIUS_LG, POPUP_SURFACE, POPUP_SHADOW_LG, ENTER_EXIT_FADE_ZOOM].join(' ')

const POPOVER_TITLE = ['mb-1 text-sm font-semibold', `text-[${v('sv-fg', T.fg)}]`].join(' ')

export const computePopoverTitleClasses = (): string => POPOVER_TITLE

const POPOVER_DESCRIPTION = ['mb-3 text-sm', `text-[${v('sv-fg-muted', T.fgMuted)}]`].join(' ')

export const computePopoverDescriptionClasses = (): string => POPOVER_DESCRIPTION


const TOOLTIP_LAYOUT = 'z-50 px-3 py-1.5 text-xs'

const TOOLTIP_SURFACE = [`bg-[${v('sv-fg', T.fg)}]`, `text-[${v('sv-bg', T.bg)}]`].join(' ')

const TOOLTIP_SHADOW = `shadow-[${v('sv-shadow-md', T.shadowMd)}]`

export const computeTooltipPopupClasses = (): string =>
  [TOOLTIP_LAYOUT, RADIUS_MD, TOOLTIP_SURFACE, TOOLTIP_SHADOW, ENTER_EXIT_FADE].join(' ')


export const computeHoverCardPopupClasses = (): string => computePopoverPopupClasses()


const MENU_POPUP_LAYOUT = 'z-50 min-w-48 py-1 outline-none'

const MENU_POPUP_INVERTED_SURFACE = [
  'border border-transparent',
  `bg-[${v('sv-primary', T.primary)}]`,
  `text-[${v('sv-primary-fg', T.primaryFg)}]`,
].join(' ')

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

const MENU_ITEM_INVERTED_BASE = `text-[${v('sv-primary-fg', T.primaryFg)}]`

const MENU_ITEM_HIGHLIGHTED_INVERTED = [
  `data-[highlighted]:bg-[${v('sv-primary-hover', T.primaryHover)}]`,
  `data-[highlighted]:text-[${v('sv-primary-fg', T.primaryFg)}]`,
].join(' ')

const MENU_ITEM_DISABLED = 'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50'

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

export const computeMenuSeparatorClasses = (): string => MENU_SEPARATOR

const MENU_TRIGGER_LAYOUT = 'px-3 py-1.5 text-sm font-medium transition-colors'

const MENU_TRIGGER_SURFACE = [
  `text-[${v('sv-fg', T.fg)}]`,
  `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `data-[open]:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
].join(' ')

export const computeMenuTriggerClasses = (): string =>
  [MENU_TRIGGER_LAYOUT, MENU_TRIGGER_SURFACE].join(' ')

const MENUBAR_CONTAINER = [
  'flex items-center border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
].join(' ')

export const computeMenubarContainerClasses = (): string => [MENUBAR_CONTAINER, RADIUS_MD].join(' ')

