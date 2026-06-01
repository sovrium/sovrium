/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'


const CAROUSEL_CONTAINER = [
  'relative overflow-hidden',
  `bg-[${v('sv-bg', T.bg)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('sv-radius-lg', T.radiusLg)}]`,
].join(' ')

export const computeCarouselContainerClasses = (): string => CAROUSEL_CONTAINER

const CAROUSEL_NAV_BUTTON_LAYOUT =
  'absolute top-1/2 -translate-y-1/2 flex items-center justify-center h-9 w-9 transition-colors'

const CAROUSEL_NAV_BUTTON_SURFACE = [
  `bg-[${v('sv-bg-overlay', T.bgOverlay)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `rounded-[${v('sv-radius-full', T.radiusFull)}]`,
  `shadow-[${v('sv-shadow-sm', T.shadowSm)}]`,
]

export type CarouselNavDirection = 'prev' | 'next'

export const computeCarouselNavButtonClasses = ({
  direction,
}: {
  readonly direction: CarouselNavDirection
}): string =>
  [
    CAROUSEL_NAV_BUTTON_LAYOUT,
    direction === 'prev' ? 'left-2' : 'right-2',
    ...CAROUSEL_NAV_BUTTON_SURFACE,
  ].join(' ')


const EMPTY_STATE_CONTAINER = [
  'flex flex-col items-center justify-center text-center gap-3 px-6 py-12',
  'border border-dashed',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `rounded-[${v('sv-radius-lg', T.radiusLg)}]`,
].join(' ')

export const computeEmptyStateContainerClasses = (): string => EMPTY_STATE_CONTAINER

const EMPTY_STATE_TITLE = ['text-lg font-semibold', `text-[${v('sv-fg', T.fg)}]`].join(' ')

export const computeEmptyStateTitleClasses = (): string => EMPTY_STATE_TITLE


export type ListItemState = 'default' | 'selected' | 'disabled'

const LIST_ITEM_LAYOUT = 'px-3 py-2 text-sm transition-colors'

const LIST_ITEM_SURFACE_BASE = `text-[${v('sv-fg', T.fg)}]`

const LIST_ITEM_INTERACTIVE = [
  'cursor-pointer',
  `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
].join(' ')

const LIST_ITEM_SELECTED = `bg-[${v('sv-primary-subtle', T.primarySubtle)}]`

const LIST_ITEM_DISABLED = 'opacity-50 cursor-not-allowed'

export const computeListItemClasses = ({
  state = 'default',
  interactive = false,
}: {
  readonly state?: ListItemState
  readonly interactive?: boolean
} = {}): string =>
  [
    LIST_ITEM_LAYOUT,
    LIST_ITEM_SURFACE_BASE,
    ...(interactive && state !== 'disabled' ? [LIST_ITEM_INTERACTIVE] : []),
    ...(state === 'selected' ? [LIST_ITEM_SELECTED] : []),
    ...(state === 'disabled' ? [LIST_ITEM_DISABLED] : []),
  ].join(' ')


export type SpeechBubbleSide = 'left' | 'right'

const SPEECH_BUBBLE_LAYOUT = 'px-4 py-3 text-sm max-w-md'

const SPEECH_BUBBLE_SURFACE = [
  `bg-[${v('sv-info-bg', T.infoBg)}]`,
  'border',
  `border-[${v('sv-info-border', T.infoBorder)}]`,
  `text-[${v('sv-info-fg', T.infoFg)}]`,
]

const SPEECH_BUBBLE_RADIUS_LEFT = [
  `rounded-tl-[${v('sv-radius-md', T.radiusMd)}]`,
  `rounded-tr-[${v('sv-radius-md', T.radiusMd)}]`,
  `rounded-br-[${v('sv-radius-md', T.radiusMd)}]`,
  'rounded-bl-none',
].join(' ')

const SPEECH_BUBBLE_RADIUS_RIGHT = [
  `rounded-tl-[${v('sv-radius-md', T.radiusMd)}]`,
  `rounded-tr-[${v('sv-radius-md', T.radiusMd)}]`,
  `rounded-bl-[${v('sv-radius-md', T.radiusMd)}]`,
  'rounded-br-none',
].join(' ')

export const computeSpeechBubbleClasses = ({
  side = 'left',
}: {
  readonly side?: SpeechBubbleSide
} = {}): string =>
  [
    SPEECH_BUBBLE_LAYOUT,
    ...SPEECH_BUBBLE_SURFACE,
    side === 'right' ? SPEECH_BUBBLE_RADIUS_RIGHT : SPEECH_BUBBLE_RADIUS_LEFT,
  ].join(' ')


const STATIC_TABLE_SHELL = [
  'w-full border-collapse overflow-hidden',
  `bg-[${v('sv-bg', T.bg)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
].join(' ')

export const computeStaticTableShellClasses = (): string => STATIC_TABLE_SHELL

const STATIC_TABLE_HEADER_ROW = [
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  'border-b',
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

export const computeStaticTableHeaderRowClasses = (): string => STATIC_TABLE_HEADER_ROW

export type StaticTableCellKind = 'header' | 'data'

const STATIC_TABLE_CELL_LAYOUT_BASE = 'px-4 py-2 text-left'

const STATIC_TABLE_CELL_HEADER = [
  'text-xs font-semibold uppercase tracking-wider',
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
].join(' ')

const STATIC_TABLE_CELL_DATA = ['text-sm', `text-[${v('sv-fg', T.fg)}]`].join(' ')

export const computeStaticTableCellClasses = ({
  kind,
}: {
  readonly kind: StaticTableCellKind
}): string =>
  [
    STATIC_TABLE_CELL_LAYOUT_BASE,
    kind === 'header' ? STATIC_TABLE_CELL_HEADER : STATIC_TABLE_CELL_DATA,
  ].join(' ')


const TIMELINE_CONTAINER = ['relative flex flex-col gap-4 pl-6'].join(' ')

export const computeTimelineContainerClasses = (): string => TIMELINE_CONTAINER

const TIMELINE_RAIL = [
  'absolute left-2 top-2 bottom-2 w-0.5',
  `bg-[${v('sv-border', T.border)}]`,
].join(' ')

export const computeTimelineRailClasses = (): string => TIMELINE_RAIL
