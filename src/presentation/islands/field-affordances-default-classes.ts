/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'
import { FOCUS_VISIBLE_RING, MOTION_COLORS, RADIUS_MD } from './shared-tokens-default-classes'


type Size = 'sm' | 'md' | 'lg'
type AttachmentTileState = 'default' | 'uploading' | 'error'

const RADIUS_SM = `rounded-[${v('sv-radius-sm', T.radiusSm)}]`
const RADIUS_LG = `rounded-[${v('sv-radius-lg', T.radiusLg)}]`
const RADIUS_FULL = `rounded-[${v('sv-radius-full', T.radiusFull)}]`

const DISABLED = 'disabled:cursor-not-allowed disabled:opacity-50'


const RATING_SIZE_GAP: Record<Size, string> = {
  sm: 'gap-0.5',
  md: 'gap-1',
  lg: 'gap-1.5',
}

export const computeRatingContainerClasses = ({ size = 'md' }: { size?: Size } = {}): string =>
  ['inline-flex items-center', RATING_SIZE_GAP[size]].join(' ')


const STAR_LAYOUT = 'inline-flex items-center justify-center'
const STAR_SIZE = 'h-5 w-5 text-base leading-none'

const STAR_FILLED = `text-[${v('sv-warning-solid', T.warningSolid)}]`
const STAR_EMPTY = `text-[${v('sv-fg-disabled', T.fgDisabled)}]`

const STAR_INTERACTIVE_HOVER = [
  `hover:text-[${v('sv-warning-solid', T.warningSolid)}]`,
  'cursor-pointer',
].join(' ')

const STAR_STATIC = 'cursor-default'

export const computeRatingStarClasses = ({
  filled,
  interactive = true,
}: {
  filled: boolean
  interactive?: boolean
}): string =>
  [
    STAR_LAYOUT,
    STAR_SIZE,
    filled ? STAR_FILLED : STAR_EMPTY,
    RADIUS_SM,
    interactive ? STAR_INTERACTIVE_HOVER : STAR_STATIC,
    interactive ? MOTION_COLORS : '',
    interactive ? FOCUS_VISIBLE_RING : '',
    interactive ? DISABLED : '',
  ]
    .filter(Boolean)
    .join(' ')


export const computeRatingHalfStarClasses = (): string =>
  [STAR_LAYOUT, STAR_SIZE, STAR_FILLED, 'opacity-50', RADIUS_SM].join(' ')


const CURRENCY_CONTAINER_LAYOUT = 'relative inline-flex w-full items-center'

const CURRENCY_CONTAINER_SURFACE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `focus-within:border-[${v('sv-focus-ring', T.focusRing)}]`,
  `focus-within:ring-1`,
  `focus-within:ring-[${v('sv-focus-ring', T.focusRing)}]`,
].join(' ')

export const computeCurrencyInputContainerClasses = (): string =>
  [CURRENCY_CONTAINER_LAYOUT, RADIUS_MD, CURRENCY_CONTAINER_SURFACE].join(' ')


const CURRENCY_SYMBOL_LAYOUT =
  'pointer-events-none inline-flex h-full items-center justify-center px-2 select-none'

const CURRENCY_SYMBOL_SURFACE = `text-[${v('sv-fg-muted', T.fgMuted)}]`

export const computeCurrencySymbolClasses = (): string =>
  [CURRENCY_SYMBOL_LAYOUT, CURRENCY_SYMBOL_SURFACE].join(' ')


const CURRENCY_DISPLAY_LAYOUT = 'inline-block tabular-nums'

const CURRENCY_DISPLAY_SURFACE = `text-[${v('sv-fg', T.fg)}]`

export const computeCurrencyDisplayClasses = (): string =>
  [CURRENCY_DISPLAY_LAYOUT, CURRENCY_DISPLAY_SURFACE].join(' ')


export const computePercentageInputContainerClasses = (): string =>
  [CURRENCY_CONTAINER_LAYOUT, RADIUS_MD, CURRENCY_CONTAINER_SURFACE].join(' ')


export const computePercentageSuffixClasses = (): string =>
  [CURRENCY_SYMBOL_LAYOUT, CURRENCY_SYMBOL_SURFACE].join(' ')


const SWATCH_SIZE_MAP: Record<Size, string> = {
  sm: 'h-5 w-5',
  md: 'h-7 w-7',
  lg: 'h-9 w-9',
}

const SWATCH_LAYOUT = 'inline-flex items-center justify-center'

const SWATCH_SURFACE = [
  'border',
  `border-[${v('sv-border-strong', T.borderStrong)}]`,
  `shadow-[${v('sv-shadow-xs', T.shadowXs)}]`,
].join(' ')

const SWATCH_MOTION = 'transition-[box-shadow,border-color] duration-150'

const SWATCH_INTERACTIVE = [
  'cursor-pointer',
  `hover:border-[${v('sv-focus-ring', T.focusRing)}]`,
  `hover:shadow-[${v('sv-shadow-sm', T.shadowSm)}]`,
].join(' ')

export const computeColorSwatchClasses = ({ size = 'md' }: { size?: Size } = {}): string =>
  [
    SWATCH_LAYOUT,
    SWATCH_SIZE_MAP[size],
    RADIUS_FULL,
    SWATCH_SURFACE,
    SWATCH_MOTION,
    SWATCH_INTERACTIVE,
    FOCUS_VISIBLE_RING,
    DISABLED,
  ].join(' ')


const COLOR_POPUP_LAYOUT = 'absolute left-0 top-full z-50 mt-1 p-3 min-w-[12rem]'

const COLOR_POPUP_SURFACE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-overlay', T.bgOverlay)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `shadow-[${v('sv-shadow-lg', T.shadowLg)}]`,
].join(' ')

export const computeColorPickerPopupClasses = (): string =>
  [COLOR_POPUP_LAYOUT, RADIUS_LG, COLOR_POPUP_SURFACE].join(' ')


const TILE_LAYOUT = 'relative inline-flex h-24 w-24 flex-col items-stretch overflow-hidden'

const TILE_DEFAULT = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `shadow-[${v('sv-shadow-xs', T.shadowXs)}]`,
].join(' ')

const TILE_UPLOADING = [
  'border-2 border-dashed',
  `border-[${v('sv-border-strong', T.borderStrong)}]`,
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  'animate-pulse',
].join(' ')

const TILE_ERROR = [
  'border',
  `border-[${v('sv-error-border', T.errorBorder)}]`,
  `bg-[${v('sv-error-bg', T.errorBg)}]`,
  `text-[${v('sv-error-fg', T.errorFg)}]`,
].join(' ')

const TILE_STATE_MAP: Record<AttachmentTileState, string> = {
  default: TILE_DEFAULT,
  uploading: TILE_UPLOADING,
  error: TILE_ERROR,
}

export const computeAttachmentTileClasses = ({
  state = 'default',
}: {
  state?: AttachmentTileState
} = {}): string => [TILE_LAYOUT, RADIUS_MD, TILE_STATE_MAP[state]].join(' ')


export const computeAttachmentTileImageClasses = (): string => 'h-16 w-full object-cover'


const ATTACHMENT_ICON_SURFACE = `text-[${v('sv-fg-muted', T.fgMuted)}]`

export const computeAttachmentTileFileIconClasses = (): string =>
  ['flex h-16 w-full items-center justify-center text-2xl', ATTACHMENT_ICON_SURFACE].join(' ')


const FILENAME_LAYOUT = 'truncate px-1 py-0.5 text-center text-xs'

const FILENAME_SURFACE = `text-[${v('sv-fg-muted', T.fgMuted)}]`

export const computeAttachmentTileFilenameClasses = (): string =>
  [FILENAME_LAYOUT, FILENAME_SURFACE].join(' ')


const REMOVE_LAYOUT =
  'absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center text-xs leading-none'

const REMOVE_SURFACE = [
  `bg-[${v('sv-bg-overlay', T.bgOverlay)}]`,
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `shadow-[${v('sv-shadow-xs', T.shadowXs)}]`,
].join(' ')

const REMOVE_HOVER = [
  `hover:bg-[${v('sv-error-bg', T.errorBg)}]`,
  `hover:text-[${v('sv-error-fg', T.errorFg)}]`,
  `hover:border-[${v('sv-error-border', T.errorBorder)}]`,
].join(' ')

export const computeAttachmentRemoveButtonClasses = (): string =>
  [
    REMOVE_LAYOUT,
    RADIUS_FULL,
    REMOVE_SURFACE,
    REMOVE_HOVER,
    MOTION_COLORS,
    FOCUS_VISIBLE_RING,
    DISABLED,
  ].join(' ')
