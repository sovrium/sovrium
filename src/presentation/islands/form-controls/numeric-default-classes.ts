/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'
import { MOTION_COLORS, RADIUS_MD } from '../recipes/shared-tokens-default-classes'


type FieldState = 'default' | 'disabled' | 'error'
type StepperDirection = 'increment' | 'decrement'
type ComponentSize = 'sm' | 'md' | 'lg'

const DISABLED_CURSOR =
  'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 disabled:cursor-not-allowed disabled:opacity-50'


const NUMBER_INPUT_WRAPPER_LAYOUT = 'inline-flex items-center overflow-hidden border'

const NUMBER_INPUT_WRAPPER_SURFACE_DEFAULT = [
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
].join(' ')

const NUMBER_INPUT_WRAPPER_SURFACE_ERROR = [
  `border-[${v('sv-error-border', T.errorBorder)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
].join(' ')

const NUMBER_INPUT_WRAPPER_FOCUS_WITHIN = [
  'focus-within:outline-none',
  'focus-within:ring-2',
  `focus-within:ring-[${v('sv-focus-ring', T.focusRing)}]`,
  `focus-within:border-[${v('sv-focus-ring', T.focusRing)}]`,
].join(' ')

export const computeNumberInputWrapperClasses = ({
  state = 'default',
}: {
  state?: FieldState
} = {}): string =>
  [
    NUMBER_INPUT_WRAPPER_LAYOUT,
    RADIUS_MD,
    state === 'error' ? NUMBER_INPUT_WRAPPER_SURFACE_ERROR : NUMBER_INPUT_WRAPPER_SURFACE_DEFAULT,
    MOTION_COLORS,
    NUMBER_INPUT_WRAPPER_FOCUS_WITHIN,
    DISABLED_CURSOR,
  ].join(' ')


const NUMBER_INPUT_FIELD_LAYOUT = 'h-9 w-20 border-0 bg-transparent px-3 text-sm text-center'

const NUMBER_INPUT_FIELD_SURFACE = [
  `text-[${v('sv-fg', T.fg)}]`,
  `placeholder:text-[${v('sv-fg-muted', T.fgMuted)}]`,
  'focus:outline-none',
  'focus:ring-0',
].join(' ')

export const computeNumberInputFieldClasses = (): string =>
  [NUMBER_INPUT_FIELD_LAYOUT, NUMBER_INPUT_FIELD_SURFACE, DISABLED_CURSOR].join(' ')


const STEPPER_LAYOUT = 'inline-flex h-9 w-9 shrink-0 items-center justify-center text-sm'

const STEPPER_SURFACE = [
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  `hover:bg-[${v('sv-primary-subtle', T.primarySubtle)}]`,
  `hover:text-[${v('sv-primary-subtle-fg', T.primarySubtleFg)}]`,
].join(' ')

const STEPPER_DIVIDER_DECREMENT = ['border-r', `border-[${v('sv-border', T.border)}]`].join(' ')

const STEPPER_DIVIDER_INCREMENT = ['border-l', `border-[${v('sv-border', T.border)}]`].join(' ')

export const computeNumberInputStepperClasses = ({
  direction,
}: {
  direction: StepperDirection
}): string =>
  [
    STEPPER_LAYOUT,
    STEPPER_SURFACE,
    direction === 'decrement' ? STEPPER_DIVIDER_DECREMENT : STEPPER_DIVIDER_INCREMENT,
    MOTION_COLORS,
    DISABLED_CURSOR,
  ].join(' ')


const SLIDER_TRACK_LAYOUT = 'relative h-1.5 w-full grow rounded-full'

const SLIDER_TRACK_SURFACE = `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`

export const computeSliderTrackClasses = ({
  state = 'default',
}: {
  state?: FieldState
} = {}): string =>
  [
    SLIDER_TRACK_LAYOUT,
    SLIDER_TRACK_SURFACE,
    MOTION_COLORS,
    state === 'disabled' ? 'opacity-50' : '',
  ]
    .filter(Boolean)
    .join(' ')


const SLIDER_RANGE_LAYOUT = 'absolute h-full rounded-full'

const SLIDER_RANGE_SURFACE = 'bg-primary'

export const computeSliderRangeClasses = (): string =>
  [SLIDER_RANGE_LAYOUT, SLIDER_RANGE_SURFACE, MOTION_COLORS].join(' ')


const SLIDER_THUMB_LAYOUT = 'block shrink-0 rounded-full border-2'

const SLIDER_THUMB_SIZE: Record<ComponentSize, string> = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
}

const SLIDER_THUMB_SURFACE = [
  `border-[${v('sv-primary', T.primary)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `hover:bg-[${v('sv-primary-subtle', T.primarySubtle)}]`,
  `shadow-[${v('sv-shadow-sm', T.shadowSm)}]`,
].join(' ')

const SLIDER_THUMB_FOCUS = [
  'focus-visible:outline-none',
  'focus-visible:ring-2',
  `focus-visible:ring-[${v('sv-focus-ring', T.focusRing)}]`,
].join(' ')

export const computeSliderThumbClasses = ({
  size = 'md',
}: {
  size?: ComponentSize
} = {}): string =>
  [
    SLIDER_THUMB_LAYOUT,
    SLIDER_THUMB_SIZE[size],
    SLIDER_THUMB_SURFACE,
    MOTION_COLORS,
    SLIDER_THUMB_FOCUS,
    DISABLED_CURSOR,
  ].join(' ')
