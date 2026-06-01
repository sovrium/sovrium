/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'
import {
  FOCUS_VISIBLE_RING,
  MOTION_COLORS,
  POPUP_SURFACE,
  RADIUS_MD,
} from './shared-tokens-default-classes'


type TriggerState = 'default' | 'open' | 'disabled'
type NavDirection = 'previous' | 'next'
type DayCellState =
  | 'default'
  | 'selected'
  | 'today'
  | 'outside'
  | 'disabled'
  | 'range-start'
  | 'range-end'
  | 'range-middle'

const RADIUS_LG = `rounded-[${v('sv-radius-lg', T.radiusLg)}]`

const DISABLED = 'disabled:cursor-not-allowed disabled:opacity-50'


const TRIGGER_LAYOUT =
  'inline-flex items-center justify-between gap-2 px-3 py-2 text-sm w-full min-w-[12rem]'

const TRIGGER_SURFACE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
].join(' ')

const TRIGGER_SHADOW = `shadow-[${v('sv-shadow-xs', T.shadowXs)}]`

const TRIGGER_OPEN = [
  `aria-expanded:border-[${v('sv-focus-ring', T.focusRing)}]`,
  `aria-expanded:ring-1`,
  `aria-expanded:ring-[${v('sv-focus-ring', T.focusRing)}]`,
].join(' ')

const TRIGGER_MOTION = 'transition-[box-shadow,border-color,background-color] duration-150'

export const computeDateTriggerClasses = ({
  state = 'default',
}: {
  state?: TriggerState
} = {}): string =>
  [
    TRIGGER_LAYOUT,
    RADIUS_MD,
    TRIGGER_SURFACE,
    TRIGGER_SHADOW,
    TRIGGER_MOTION,
    FOCUS_VISIBLE_RING,
    TRIGGER_OPEN,
    DISABLED,
    state === 'disabled' ? 'cursor-not-allowed opacity-50' : '',
  ]
    .filter(Boolean)
    .join(' ')


const POPUP_LAYOUT = 'absolute left-0 top-full z-50 mt-1 p-3'

const POPUP_SHADOW = `shadow-[${v('sv-shadow-lg', T.shadowLg)}]`

export const computeDatePopupClasses = (): string =>
  [POPUP_LAYOUT, RADIUS_LG, POPUP_SURFACE, POPUP_SHADOW].join(' ')


const NAV_BUTTON_LAYOUT = 'inline-flex h-7 w-7 items-center justify-center text-sm'

const NAV_BUTTON_SURFACE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `hover:text-[${v('sv-fg', T.fg)}]`,
].join(' ')

export const computeDateNavButtonClasses = ({
  direction: _direction,
}: {
  direction: NavDirection
}): string =>
  [NAV_BUTTON_LAYOUT, RADIUS_MD, NAV_BUTTON_SURFACE, MOTION_COLORS, FOCUS_VISIBLE_RING, DISABLED]
    .filter(Boolean)
    .join(' ')


const CAPTION_LAYOUT = 'text-sm font-medium'

const CAPTION_SURFACE = `text-[${v('sv-fg', T.fg)}]`

export const computeDateCaptionClasses = (): string => [CAPTION_LAYOUT, CAPTION_SURFACE].join(' ')


const WEEKDAY_LAYOUT = 'h-8 w-8 px-1 py-1 text-center text-xs font-normal'

const WEEKDAY_SURFACE = `text-[${v('sv-fg-muted', T.fgMuted)}]`

export const computeDateWeekdayClasses = (): string => [WEEKDAY_LAYOUT, WEEKDAY_SURFACE].join(' ')


const DAY_LAYOUT = 'inline-flex h-8 w-8 items-center justify-center text-sm'

const DAY_DEFAULT = [
  `text-[${v('sv-fg', T.fg)}]`,
  `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
].join(' ')

const DAY_SELECTED = [
  `bg-[${v('sv-primary', T.primary)}]`,
  `text-[${v('sv-primary-fg', T.primaryFg)}]`,
  `hover:bg-[${v('sv-primary-hover', T.primaryHover)}]`,
].join(' ')

const DAY_TODAY = [
  `text-[${v('sv-fg', T.fg)}]`,
  `font-semibold`,
  `ring-1`,
  `ring-[${v('sv-border-strong', T.borderStrong)}]`,
  `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
].join(' ')

const DAY_OUTSIDE = [
  `text-[${v('sv-fg-disabled', T.fgDisabled)}]`,
  `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
].join(' ')

const DAY_DISABLED = [`text-[${v('sv-fg-disabled', T.fgDisabled)}]`, 'cursor-not-allowed'].join(' ')

const DAY_RANGE_MIDDLE = [
  `bg-[${v('sv-primary-subtle', T.primarySubtle)}]`,
  `text-[${v('sv-primary-subtle-fg', T.primarySubtleFg)}]`,
  'rounded-none',
].join(' ')

const DAY_RANGE_START = [
  `bg-[${v('sv-primary', T.primary)}]`,
  `text-[${v('sv-primary-fg', T.primaryFg)}]`,
].join(' ')

const DAY_RANGE_END = DAY_RANGE_START

const DAY_STATE_MAP: Record<DayCellState, string> = {
  default: DAY_DEFAULT,
  selected: DAY_SELECTED,
  today: DAY_TODAY,
  outside: DAY_OUTSIDE,
  disabled: DAY_DISABLED,
  'range-start': DAY_RANGE_START,
  'range-end': DAY_RANGE_END,
  'range-middle': DAY_RANGE_MIDDLE,
}

export const computeDateDayClasses = ({
  state = 'default',
}: {
  state?: DayCellState
} = {}): string =>
  [
    DAY_LAYOUT,
    state === 'range-middle' ? '' : RADIUS_MD,
    DAY_STATE_MAP[state],
    MOTION_COLORS,
    FOCUS_VISIBLE_RING,
    DISABLED,
  ]
    .filter(Boolean)
    .join(' ')
