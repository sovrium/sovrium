/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'
import {
  FOCUS_VISIBLE_RING,
  MOTION_COLORS as MOTION,
  RADIUS_MD,
} from './shared-tokens-default-classes'


type ToggleVariant = 'default' | 'outline'
type ComponentSize = 'sm' | 'md' | 'lg'
type SwitchState = 'default' | 'checked' | 'disabled'

const DISABLED = 'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50'


const TOGGLE_LAYOUT = 'inline-flex items-center justify-center font-medium'

const TOGGLE_SIZE: Record<ComponentSize, string> = {
  sm: 'h-8 px-2 text-xs',
  md: 'h-9 px-3 text-sm',
  lg: 'h-10 px-4 text-base',
}

const TOGGLE_VARIANT_DEFAULT = [
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `data-[pressed]:bg-[${v('sv-primary-subtle', T.primarySubtle)}]`,
  `data-[pressed]:text-[${v('sv-primary-subtle-fg', T.primarySubtleFg)}]`,
].join(' ')

const TOGGLE_VARIANT_OUTLINE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `data-[pressed]:bg-[${v('sv-primary-subtle', T.primarySubtle)}]`,
  `data-[pressed]:border-[${v('sv-border-strong', T.borderStrong)}]`,
  `data-[pressed]:text-[${v('sv-primary-subtle-fg', T.primarySubtleFg)}]`,
].join(' ')

export const computeToggleClasses = ({
  variant = 'default',
  size = 'md',
}: {
  variant?: ToggleVariant
  size?: ComponentSize
} = {}): string =>
  [
    TOGGLE_LAYOUT,
    RADIUS_MD,
    TOGGLE_SIZE[size],
    variant === 'outline' ? TOGGLE_VARIANT_OUTLINE : TOGGLE_VARIANT_DEFAULT,
    MOTION,
    FOCUS_VISIBLE_RING,
    DISABLED,
  ].join(' ')


const TOGGLE_GROUP_LAYOUT = 'inline-flex'

const TOGGLE_GROUP_SURFACE = ['border', `border-[${v('sv-border', T.border)}]`].join(' ')

export const computeToggleGroupClasses = (): string =>
  [TOGGLE_GROUP_LAYOUT, RADIUS_MD, TOGGLE_GROUP_SURFACE, 'overflow-hidden'].join(' ')

const TOGGLE_GROUP_ITEM_LAYOUT = 'px-3 py-2 text-sm font-medium'

const TOGGLE_GROUP_ITEM_SURFACE = [
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  `data-[pressed]:bg-[${v('sv-primary-subtle', T.primarySubtle)}]`,
  `data-[pressed]:text-[${v('sv-fg', T.fg)}]`,
].join(' ')

const TOGGLE_GROUP_ITEM_DIVIDER = [
  'border-r last:border-r-0',
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

export const computeToggleGroupItemClasses = (): string =>
  [
    TOGGLE_GROUP_ITEM_LAYOUT,
    TOGGLE_GROUP_ITEM_SURFACE,
    TOGGLE_GROUP_ITEM_DIVIDER,
    MOTION,
    FOCUS_VISIBLE_RING,
    DISABLED,
  ].join(' ')


const SWITCH_TRACK_LAYOUT = 'relative inline-flex shrink-0 items-center border-2 border-transparent'

const SWITCH_TRACK_SIZE: Record<ComponentSize, string> = {
  sm: 'h-4 w-7',
  md: 'h-5 w-9',
  lg: 'h-6 w-11',
}

const SWITCH_TRACK_SURFACE = [
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  'data-[checked]:bg-primary',
].join(' ')

export const computeSwitchTrackClasses = ({
  size = 'md',
}: {
  size?: ComponentSize
  state?: SwitchState
} = {}): string =>
  [
    SWITCH_TRACK_LAYOUT,
    'rounded-full',
    SWITCH_TRACK_SIZE[size],
    SWITCH_TRACK_SURFACE,
    MOTION,
    FOCUS_VISIBLE_RING,
    DISABLED,
  ].join(' ')

const SWITCH_THUMB_LAYOUT = 'pointer-events-none block'

const SWITCH_THUMB_SIZE: Record<ComponentSize, string> = {
  sm: 'h-3 w-3 data-[checked]:translate-x-3',
  md: 'h-4 w-4 data-[checked]:translate-x-4',
  lg: 'h-5 w-5 data-[checked]:translate-x-5',
}

const SWITCH_THUMB_SURFACE = `bg-[${v('sv-bg-raised', T.bgRaised)}]`

const SWITCH_THUMB_SHADOW = `shadow-[${v('sv-shadow-sm', T.shadowSm)}]`

export const computeSwitchThumbClasses = ({
  size = 'md',
}: {
  size?: ComponentSize
  state?: SwitchState
} = {}): string =>
  [
    SWITCH_THUMB_LAYOUT,
    'rounded-full',
    SWITCH_THUMB_SIZE[size],
    SWITCH_THUMB_SURFACE,
    SWITCH_THUMB_SHADOW,
    'transition-transform duration-150',
  ].join(' ')
