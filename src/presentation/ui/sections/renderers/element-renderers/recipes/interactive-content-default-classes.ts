/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'


const BUTTON_GROUP_CONTAINER = [
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
  `shadow-[${v('sv-shadow-xs', T.shadowXs)}]`,
].join(' ')

export const computeButtonGroupClasses = (): string => BUTTON_GROUP_CONTAINER

export type ButtonGroupItemPosition = 'first' | 'middle' | 'last' | 'only'

const BUTTON_GROUP_ITEM: Record<ButtonGroupItemPosition, string> = {
  only: '',
  first: 'rounded-r-none',
  middle: 'rounded-none',
  last: 'rounded-l-none',
}

export const computeButtonGroupItemClasses = ({
  position,
}: {
  readonly position: ButtonGroupItemPosition
}): string => BUTTON_GROUP_ITEM[position]


export type LinkVariant = 'default' | 'subtle' | 'destructive'

const LINK_VARIANT: Record<LinkVariant, string> = {
  default: [
    `text-[${v('sv-primary', T.primary)}]`,
    `hover:decoration-[${v('sv-warmth', T.warmth)}]`,
  ].join(' '),
  subtle: [
    `text-[${v('sv-fg-muted', T.fgMuted)}]`,
    `hover:text-[${v('sv-fg', T.fg)}]`,
    `hover:decoration-[${v('sv-warmth', T.warmth)}]`,
  ].join(' '),
  destructive: [
    `text-[${v('sv-error-fg', T.errorFg)}]`,
    `hover:decoration-[${v('sv-error-fg', T.errorFg)}]`,
  ].join(' '),
}

const LINK_SHARED = [
  'underline-offset-4 decoration-2',
  'hover:underline',
  'focus-visible:outline-none focus-visible:underline',
  `focus-visible:decoration-[${v('sv-focus-ring', T.focusRing)}]`,
  'transition-colors duration-150',
].join(' ')

export const computeLinkClasses = ({
  variant = 'default',
}: {
  readonly variant?: LinkVariant
} = {}): string => [LINK_VARIANT[variant], LINK_SHARED].join(' ')


export type IconSize = 'sm' | 'md' | 'lg' | 'xl'

const ICON_SIZE: Record<IconSize, string> = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
  xl: 'w-6 h-6',
}

export type IconTone = 'default' | 'muted' | 'primary'

const ICON_TONE: Record<IconTone, string> = {
  default: `text-[${v('sv-fg', T.fg)}]`,
  muted: `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  primary: `text-[${v('sv-primary', T.primary)}]`,
}

export const computeIconClasses = ({
  size = 'md',
  tone = 'default',
}: {
  readonly size?: IconSize
  readonly tone?: IconTone
} = {}): string => [ICON_SIZE[size], ICON_TONE[tone]].join(' ')


export type ImageRadius = 'none' | 'sm' | 'md' | 'lg' | 'full'

const IMAGE_RADIUS: Record<ImageRadius, string> = {
  none: '',
  sm: `rounded-[${v('sv-radius-sm', T.radiusSm)}]`,
  md: `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
  lg: `rounded-[${v('sv-radius-lg', T.radiusLg)}]`,
  full: `rounded-[${v('sv-radius-full', T.radiusFull)}]`,
}

export type ImageFit = 'cover' | 'contain'

const IMAGE_FIT: Record<ImageFit, string> = {
  cover: 'object-cover',
  contain: 'object-contain',
}

export const computeImageClasses = ({
  radius = 'md',
  fit = 'cover',
}: {
  readonly radius?: ImageRadius
  readonly fit?: ImageFit
} = {}): string => [IMAGE_RADIUS[radius], IMAGE_FIT[fit]].filter(Boolean).join(' ')


const IFRAME_FRAME = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
].join(' ')

export const computeIframeClasses = (): string => IFRAME_FRAME


const AUDIO_FRAME = [
  'block w-full',
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
].join(' ')

export const computeAudioPlayerClasses = (): string => AUDIO_FRAME

const VIDEO_FRAME = [
  'block w-full',
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
  'overflow-hidden',
].join(' ')

export const computeVideoPlayerClasses = (): string => VIDEO_FRAME


const SEARCH_CONTAINER = ['relative w-full', `text-[${v('sv-fg', T.fg)}]`].join(' ')

export const computeSearchInputContainerClasses = (): string => SEARCH_CONTAINER

const SEARCH_FIELD = [
  'w-full',
  'px-3 py-2',
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg', T.bg)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
  `shadow-[${v('sv-shadow-xs', T.shadowXs)}]`,
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
  `focus-visible:ring-[${v('sv-focus-ring', T.focusRing)}]`,
  'transition-[box-shadow,border-color] duration-150',
].join(' ')

export const computeSearchInputFieldClasses = (): string => SEARCH_FIELD
