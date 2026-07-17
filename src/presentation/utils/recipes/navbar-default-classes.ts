/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'


export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

const BADGE_LAYOUT =
  'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium leading-none whitespace-nowrap'

export const BADGE_RADIUS = `rounded-[${v('sv-radius-full', T.radiusFull)}]`

export const BADGE_VARIANT_CLASS: Record<BadgeVariant, string> = {
  default: [
    `bg-[${v('sv-primary', T.primary)}]`,
    `text-[${v('sv-primary-fg', T.primaryFg)}]`,
    'border border-transparent',
  ].join(' '),
  secondary: [
    `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
    `text-[${v('sv-fg', T.fg)}]`,
    'border',
    `border-[${v('sv-border', T.border)}]`,
  ].join(' '),
  destructive: [
    `bg-[${v('sv-error-solid', T.errorSolid)}]`,
    `text-[${v('sv-error-solid-fg', T.errorSolidFg)}]`,
    'border border-transparent',
  ].join(' '),
  outline: [
    'bg-transparent',
    `text-[${v('sv-fg', T.fg)}]`,
    'border',
    `border-[${v('sv-border-strong', T.borderStrong)}]`,
  ].join(' '),
}

export const computeBadgeClasses = ({
  variant = 'default',
}: {
  variant?: BadgeVariant
} = {}): string => [BADGE_LAYOUT, BADGE_RADIUS, BADGE_VARIANT_CLASS[variant]].join(' ')


const NAV_MENU_RADIUS_MD = `rounded-[${v('sv-radius-md', T.radiusMd)}]`

const NAV_MENU_TRIGGER = [
  'inline-flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors',
  `text-[${v('sv-fg', T.fg)}]`,
  `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
].join(' ')

export const computeNavMenuTriggerClasses = (override?: string): string =>
  `group ${override ?? [NAV_MENU_TRIGGER, NAV_MENU_RADIUS_MD].join(' ')}`
