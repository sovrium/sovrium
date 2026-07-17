/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'
import {
  computeBadgeClasses,
  BADGE_RADIUS,
  BADGE_VARIANT_CLASS,
  type BadgeVariant,
} from '@/presentation/utils/recipes/navbar-default-classes'

export { computeBadgeClasses, type BadgeVariant }


export type AlertVariant = 'default' | 'destructive' | 'warning' | 'info' | 'success'

export type SkeletonVariant = 'text' | 'circular' | 'rectangular'

export type StatusDotColor = 'green' | 'red' | 'amber' | 'yellow' | 'blue' | 'gray'

export type ProgressSize = 'sm' | 'md' | 'lg'


const STATUS_DOT_COLOR_CLASS: Record<StatusDotColor, string> = {
  green: `bg-[${v('sv-success-solid', T.successSolid)}]`,
  red: `bg-[${v('sv-error-solid', T.errorSolid)}]`,
  amber: `bg-[${v('sv-warning-solid', T.warningSolid)}]`,
  yellow: `bg-[${v('sv-warning-solid', T.warningSolid)}]`,
  blue: `bg-[${v('sv-info-solid', T.infoSolid)}]`,
  gray: `bg-[${v('sv-neutral-500', T.neutral500)}]`,
}

export const computeStatusBadgeWrapperClasses = (): string =>
  [
    'inline-flex items-center gap-1.5',
    'px-2 py-0.5 text-xs font-medium leading-none whitespace-nowrap',
    BADGE_RADIUS,
    BADGE_VARIANT_CLASS.secondary,
  ].join(' ')

export const computeStatusBadgeDotClasses = ({
  color = 'gray',
  pulse = false,
}: {
  color?: StatusDotColor
  pulse?: boolean
} = {}): string =>
  [
    'inline-block h-2 w-2 rounded-full shrink-0',
    STATUS_DOT_COLOR_CLASS[color],
    pulse ? 'animate-pulse' : '',
  ]
    .filter(Boolean)
    .join(' ')


const ALERT_LAYOUT = 'flex items-start gap-3 px-4 py-3 text-sm'

const ALERT_RADIUS = `rounded-[${v('sv-radius-md', T.radiusMd)}]`

const ALERT_VARIANT_CLASS: Record<AlertVariant, string> = {
  default: [
    'border',
    `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
    `text-[${v('sv-fg', T.fg)}]`,
    `border-[${v('sv-border', T.border)}]`,
  ].join(' '),
  info: [
    'border',
    `bg-[${v('sv-info-bg', T.infoBg)}]`,
    `text-[${v('sv-info-fg', T.infoFg)}]`,
    `border-[${v('sv-info-border', T.infoBorder)}]`,
  ].join(' '),
  success: [
    'border',
    `bg-[${v('sv-success-bg', T.successBg)}]`,
    `text-[${v('sv-success-fg', T.successFg)}]`,
    `border-[${v('sv-success-border', T.successBorder)}]`,
  ].join(' '),
  warning: [
    'border',
    `bg-[${v('sv-warning-bg', T.warningBg)}]`,
    `text-[${v('sv-warning-fg', T.warningFg)}]`,
    `border-[${v('sv-warning-border', T.warningBorder)}]`,
  ].join(' '),
  destructive: [
    'border',
    `bg-[${v('sv-error-bg', T.errorBg)}]`,
    `text-[${v('sv-error-fg', T.errorFg)}]`,
    `border-[${v('sv-error-border', T.errorBorder)}]`,
  ].join(' '),
}

export const computeAlertClasses = ({
  variant = 'default',
}: {
  variant?: AlertVariant
} = {}): string => [ALERT_LAYOUT, ALERT_RADIUS, ALERT_VARIANT_CLASS[variant]].join(' ')

const ALERT_ICON_LAYOUT = 'text-lg leading-none shrink-0'

export const computeAlertIconClasses = (): string => ALERT_ICON_LAYOUT


const SKELETON_VARIANT_RADIUS: Record<SkeletonVariant, string> = {
  text: `rounded-[${v('sv-radius-base', T.radiusBase)}]`,
  circular: `rounded-[${v('sv-radius-full', T.radiusFull)}]`,
  rectangular: `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
}

const SKELETON_SURFACE = `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`

export const computeSkeletonClasses = ({
  variant = 'text',
  animate = true,
}: {
  variant?: SkeletonVariant
  animate?: boolean
} = {}): string =>
  [SKELETON_SURFACE, SKELETON_VARIANT_RADIUS[variant], animate ? 'animate-pulse' : '']
    .filter(Boolean)
    .join(' ')


const PROGRESS_TRACK_LAYOUT = 'w-full overflow-hidden'

const PROGRESS_TRACK_SURFACE = [
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `rounded-[${v('sv-radius-full', T.radiusFull)}]`,
].join(' ')

export const computeProgressTrackClasses = (): string =>
  [PROGRESS_TRACK_LAYOUT, PROGRESS_TRACK_SURFACE].join(' ')

const PROGRESS_BAR_LAYOUT = 'h-full'

const PROGRESS_BAR_SURFACE = [
  `bg-[${v('sv-primary', T.primary)}]`,
  `rounded-[${v('sv-radius-full', T.radiusFull)}]`,
].join(' ')

export const computeProgressBarClasses = (): string =>
  [PROGRESS_BAR_LAYOUT, PROGRESS_BAR_SURFACE].join(' ')

export const computeProgressCircleTrackStroke = (): string => v('sv-border', T.border)

export const computeProgressCircleBarStroke = (): string => v('sv-primary', T.primary)

const PROGRESS_LABEL_LAYOUT = 'shrink-0 text-sm font-medium'

const PROGRESS_LABEL_SURFACE = `text-[${v('sv-fg', T.fg)}]`

export const computeProgressLabelClasses = (): string =>
  [PROGRESS_LABEL_LAYOUT, PROGRESS_LABEL_SURFACE].join(' ')
