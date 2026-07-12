/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'


const DATA_TABLE_SHELL = [
  'overflow-hidden',
  `bg-[${v('sv-bg', T.bg)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
].join(' ')

export const computeDataTableShellClasses = (): string => DATA_TABLE_SHELL


const DATA_TABLE_HEADER = [
  'px-4 py-2',
  'text-xs font-semibold uppercase tracking-wider',
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  'border-b',
  `border-[${v('sv-border', T.border)}]`,
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
].join(' ')

export const computeDataTableHeaderClasses = (): string => DATA_TABLE_HEADER


export type DataTableRowState = 'default' | 'selected' | 'last'

const DATA_TABLE_ROW_BASE = ['px-4 py-3', 'text-sm', `text-[${v('sv-fg', T.fg)}]`].join(' ')

const DATA_TABLE_ROW_BORDER = ['border-b', `border-[${v('sv-border', T.border)}]`].join(' ')

const DATA_TABLE_ROW_SELECTED_TINT = `bg-[${v('sv-primary-subtle', T.primarySubtle)}]`

export const computeDataTableRowClasses = ({
  state = 'default',
}: {
  readonly state?: DataTableRowState
} = {}): string =>
  [
    DATA_TABLE_ROW_BASE,
    ...(state === 'last' ? [] : [DATA_TABLE_ROW_BORDER]),
    ...(state === 'selected' ? [DATA_TABLE_ROW_SELECTED_TINT] : []),
  ].join(' ')


export type DataTableStatusTone = 'success' | 'warning' | 'muted'

const STATUS_BADGE_BASE =
  'inline-flex items-center w-fit px-2 py-0.5 text-xs font-medium rounded-full'

const STATUS_BADGE_TONE: Record<DataTableStatusTone, string> = {
  success: [
    `bg-[${v('sv-success-bg', T.successBg)}]`,
    `text-[${v('sv-success-fg', T.successFg)}]`,
  ].join(' '),
  warning: [
    `bg-[${v('sv-warning-bg', T.warningBg)}]`,
    `text-[${v('sv-warning-fg', T.warningFg)}]`,
  ].join(' '),
  muted: [
    `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
    `text-[${v('sv-fg-muted', T.fgMuted)}]`,
    'border',
    `border-[${v('sv-border', T.border)}]`,
  ].join(' '),
}

export const computeDataTableStatusBadgeClasses = ({
  tone,
}: {
  readonly tone: DataTableStatusTone
}): string => [STATUS_BADGE_BASE, STATUS_BADGE_TONE[tone]].join(' ')


const KANBAN_COLUMN = [
  'p-3 flex flex-col gap-2',
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
].join(' ')

export const computeKanbanColumnClasses = (): string => KANBAN_COLUMN


const KANBAN_CARD = [
  'p-3 text-sm',
  `bg-[${v('sv-bg', T.bg)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
  `shadow-[${v('sv-shadow-sm', T.shadowSm)}]`,
].join(' ')

export const computeKanbanCardClasses = (): string => KANBAN_CARD


const CHART_SHELL = [
  'p-4',
  `bg-[${v('sv-bg', T.bg)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
].join(' ')

export const computeChartShellClasses = (): string => CHART_SHELL
