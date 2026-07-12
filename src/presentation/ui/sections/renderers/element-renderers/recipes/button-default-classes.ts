/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'

export type ButtonVariant =
  | 'default'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link'
  | 'fab'

export type ButtonSize = 'sm' | 'md' | 'lg'

export type ButtonState = 'default' | 'disabled' | 'loading'

export interface ButtonDefaultClassesInput {
  readonly variant?: ButtonVariant
  readonly size?: ButtonSize
  readonly state?: ButtonState
}


const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: [
    `bg-[${v('sv-primary', T.primary)}]`,
    `text-[${v('sv-primary-fg', T.primaryFg)}]`,
    `border-[${v('sv-primary', T.primary)}]`,
    `hover:bg-[${v('sv-primary-hover', T.primaryHover)}]`,
    `active:bg-[${v('sv-primary-active', T.primaryActive)}]`,
  ].join(' '),
  destructive: [
    `bg-[${v('sv-error-solid', T.errorSolid)}]`,
    `text-[${v('sv-error-solid-fg', T.errorSolidFg)}]`,
    `border-[${v('sv-error-solid', T.errorSolid)}]`,
    `hover:bg-[${v('sv-error-600', T.error600)}]`,
    `active:bg-[${v('sv-error-700', T.error700)}]`,
  ].join(' '),
  outline: [
    `bg-[${v('sv-bg', T.bg)}]`,
    `text-[${v('sv-fg', T.fg)}]`,
    `border-[${v('sv-border-strong', T.borderStrong)}]`,
    `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
    `hover:border-[${v('sv-fg', T.fg)}]`,
  ].join(' '),
  secondary: [
    `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
    `text-[${v('sv-fg', T.fg)}]`,
    `border-[${v('sv-border', T.border)}]`,
    `hover:bg-[${v('sv-bg-raised', T.bgRaised)}]`,
    `hover:border-[${v('sv-border-strong', T.borderStrong)}]`,
  ].join(' '),
  ghost: [
    'bg-transparent',
    `text-[${v('sv-fg', T.fg)}]`,
    'border-transparent',
    `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  ].join(' '),
  link: [
    'bg-transparent',
    `text-[${v('sv-primary', T.primary)}]`,
    'border-transparent',
    'underline-offset-4',
    'hover:underline',
  ].join(' '),
  fab: [
    `bg-[${v('sv-primary', T.primary)}]`,
    `text-[${v('sv-primary-fg', T.primaryFg)}]`,
    `border-[${v('sv-primary', T.primary)}]`,
    `hover:bg-[${v('sv-primary-hover', T.primaryHover)}]`,
  ].join(' '),
}


const SIZE_CLASS_DEFAULT: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 py-1 text-xs',
  md: 'h-9 px-4 py-2 text-sm',
  lg: 'h-11 px-5 py-2.5 text-base',
}

const SIZE_CLASS_LINK: Record<ButtonSize, string> = {
  sm: 'h-auto p-0 text-xs',
  md: 'h-auto p-0 text-sm',
  lg: 'h-auto p-0 text-base',
}

const sizeClasses = (size: ButtonSize, variant: ButtonVariant): string => {
  if (variant === 'fab') return 'h-14 w-14 p-0'
  if (variant === 'link') return SIZE_CLASS_LINK[size]
  return SIZE_CLASS_DEFAULT[size]
}

const FOCUS_CLASS = [
  'focus-visible:outline-none',
  'focus-visible:ring-2',
  'focus-visible:ring-offset-2',
  `focus-visible:ring-[${v('sv-focus-ring', T.focusRing)}]`,
  `focus-visible:ring-offset-[${v('sv-bg', T.bg)}]`,
].join(' ')

const STATE_CLASS: Record<ButtonState, string> = {
  default: '',
  disabled: 'opacity-50 cursor-not-allowed',
  loading: 'opacity-75 cursor-progress',
}

const MOTION_DEFAULT =
  'transition-[transform,box-shadow,background-color,border-color] duration-150 hover:translate-y-[-1px]'

const SHADOW_GHOST = `shadow-[${v('sv-shadow-none', T.shadowNone)}]`
const SHADOW_INACTIVE = `shadow-[${v('sv-shadow-xs', T.shadowXs)}]`
const SHADOW_ACTIVE = `shadow-[${v('sv-shadow-sm', T.shadowSm)}] hover:shadow-[${v('sv-shadow-md', T.shadowMd)}]`

const elevationClass = (variant: ButtonVariant, state: ButtonState): string => {
  if (variant === 'ghost') return SHADOW_GHOST
  return state === 'default' ? SHADOW_ACTIVE : SHADOW_INACTIVE
}

const radiusClass = (variant: ButtonVariant): string =>
  variant === 'fab'
    ? `rounded-[${v('sv-radius-full', T.radiusFull)}]`
    : `rounded-[${v('sv-radius-md', T.radiusMd)}]`


const linkClasses = (size: ButtonSize, state: ButtonState): string =>
  [
    'inline-flex items-center justify-center font-medium',
    sizeClasses(size, 'link'),
    VARIANT_CLASS.link,
    FOCUS_CLASS,
    STATE_CLASS[state],
  ]
    .filter(Boolean)
    .join(' ')

const filledClasses = (variant: ButtonVariant, size: ButtonSize, state: ButtonState): string =>
  [
    'inline-flex items-center justify-center border font-medium',
    radiusClass(variant),
    sizeClasses(size, variant),
    VARIANT_CLASS[variant],
    elevationClass(variant, state),
    state === 'default' ? MOTION_DEFAULT : '',
    FOCUS_CLASS,
    STATE_CLASS[state],
  ]
    .filter(Boolean)
    .join(' ')

export const computeButtonDefaultClasses = (input: ButtonDefaultClassesInput = {}): string => {
  const variant = input.variant ?? 'default'
  const size = input.size ?? 'md'
  const state = input.state ?? 'default'
  return variant === 'link' ? linkClasses(size, state) : filledClasses(variant, size, state)
}
