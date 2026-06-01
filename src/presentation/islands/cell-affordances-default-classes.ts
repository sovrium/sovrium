/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'
import { RADIUS_MD } from './shared-tokens-default-classes'


type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'error'
type FormulaKind = 'number' | 'text' | 'date' | 'error'

const RADIUS_SM = `rounded-[${v('sv-radius-sm', T.radiusSm)}]`
const RADIUS_FULL = `rounded-[${v('sv-radius-full', T.radiusFull)}]`

const PILL_LAYOUT = 'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs max-w-full'


const USER_PILL_SURFACE = [
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

export const computeUserPillClasses = (): string =>
  [PILL_LAYOUT, RADIUS_FULL, USER_PILL_SURFACE].join(' ')

const USER_AVATAR_LAYOUT =
  'inline-flex h-4 w-4 flex-shrink-0 items-center justify-center overflow-hidden text-[10px] leading-none font-medium uppercase'

const USER_AVATAR_SURFACE = [
  `bg-[${v('sv-primary', T.primary)}]`,
  `text-[${v('sv-primary-fg', T.primaryFg)}]`,
].join(' ')

export const computeUserAvatarClasses = (): string =>
  [USER_AVATAR_LAYOUT, RADIUS_FULL, USER_AVATAR_SURFACE].join(' ')

export const computeUserNameClasses = (): string => 'min-w-0 truncate'


const LINKED_RECORD_SURFACE = [
  `bg-[${v('sv-info-bg', T.infoBg)}]`,
  `text-[${v('sv-info-fg', T.infoFg)}]`,
  'border',
  `border-[${v('sv-info-border', T.infoBorder)}]`,
].join(' ')

export const computeLinkedRecordPillClasses = (): string =>
  [PILL_LAYOUT, RADIUS_FULL, LINKED_RECORD_SURFACE, 'truncate'].join(' ')

export const computeLinkedRecordWrapClasses = (): string =>
  'inline-flex flex-wrap items-center gap-1'


const STATUS_TONE_MAP: Record<StatusTone, string> = {
  neutral: [
    `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
    `text-[${v('sv-fg', T.fg)}]`,
    `border-[${v('sv-border', T.border)}]`,
  ].join(' '),
  info: [
    `bg-[${v('sv-info-bg', T.infoBg)}]`,
    `text-[${v('sv-info-fg', T.infoFg)}]`,
    `border-[${v('sv-info-border', T.infoBorder)}]`,
  ].join(' '),
  success: [
    `bg-[${v('sv-success-bg', T.successBg)}]`,
    `text-[${v('sv-success-fg', T.successFg)}]`,
    `border-[${v('sv-success-border', T.successBorder)}]`,
  ].join(' '),
  warning: [
    `bg-[${v('sv-warning-bg', T.warningBg)}]`,
    `text-[${v('sv-warning-fg', T.warningFg)}]`,
    `border-[${v('sv-warning-border', T.warningBorder)}]`,
  ].join(' '),
  error: [
    `bg-[${v('sv-error-bg', T.errorBg)}]`,
    `text-[${v('sv-error-fg', T.errorFg)}]`,
    `border-[${v('sv-error-border', T.errorBorder)}]`,
  ].join(' '),
}

export const computeStatusPillClasses = ({
  tone = 'neutral',
}: { tone?: StatusTone } = {}): string =>
  [PILL_LAYOUT, RADIUS_FULL, 'border font-medium', STATUS_TONE_MAP[tone]].join(' ')


const FORMULA_KIND_MAP: Record<FormulaKind, string> = {
  number: ['tabular-nums', `text-[${v('sv-fg', T.fg)}]`].join(' '),
  text: `text-[${v('sv-fg', T.fg)}]`,
  date: `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  error: ['italic', `text-[${v('sv-error-fg', T.errorFg)}]`].join(' '),
}

export const computeFormulaReadonlyClasses = ({
  kind = 'text',
}: { kind?: FormulaKind } = {}): string =>
  ['inline-block max-w-full truncate', FORMULA_KIND_MAP[kind]].join(' ')


const GEOLOC_SURFACE = [
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

export const computeGeolocationClasses = (): string =>
  ['inline-flex items-center gap-1.5 px-2 py-0.5 text-xs', RADIUS_MD, GEOLOC_SURFACE].join(' ')

export const computeGeolocationCoordClasses = (): string =>
  ['font-mono tabular-nums text-[11px]', `text-[${v('sv-fg', T.fg)}]`].join(' ')

export const computeGeolocationPinClasses = (): string =>
  ['inline-flex items-center text-xs leading-none', `text-[${v('sv-fg-muted', T.fgMuted)}]`].join(
    ' '
  )


const COUNT_SURFACE = [
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

export const computeCountBadgeClasses = (): string =>
  [
    'inline-flex min-w-[1.5rem] items-center justify-center px-1.5 py-0.5 text-xs font-medium tabular-nums',
    RADIUS_FULL,
    COUNT_SURFACE,
  ].join(' ')


const JSON_PREVIEW_SURFACE = [
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
].join(' ')

export const computeJsonPreviewClasses = (): string =>
  [
    'inline-block max-w-full truncate px-1.5 py-0.5 font-mono text-[11px]',
    RADIUS_SM,
    JSON_PREVIEW_SURFACE,
  ].join(' ')


const ARRAY_CHIP_SURFACE = [
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

export const computeArrayChipsWrapClasses = (): string =>
  'inline-flex flex-wrap items-center gap-1 max-w-full'

export const computeArrayChipClasses = (): string =>
  ['inline-flex items-center px-1.5 py-0 text-[11px]', RADIUS_SM, ARRAY_CHIP_SURFACE].join(' ')


const CODE_INLINE_SURFACE = [
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
].join(' ')

export const computeCodeInlineClasses = (): string =>
  [
    'inline-block max-w-full truncate px-1 py-0.5 font-mono text-[11px]',
    RADIUS_SM,
    CODE_INLINE_SURFACE,
  ].join(' ')
