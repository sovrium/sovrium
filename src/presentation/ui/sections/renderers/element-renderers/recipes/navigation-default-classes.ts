/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'


export type BreadcrumbItemState = 'default' | 'current'

export type PaginationButtonState = 'default' | 'selected' | 'disabled'

export type TocLinkState = 'default' | 'active'


const BREADCRUMB_LIST_LAYOUT = 'flex flex-wrap items-center gap-2 text-sm'

export const computeBreadcrumbListClasses = (): string => BREADCRUMB_LIST_LAYOUT

const BREADCRUMB_ITEM_STATE_CLASS: Record<BreadcrumbItemState, string> = {
  default: [
    `text-[${v('sv-fg-muted', T.fgMuted)}]`,
    `hover:text-[${v('sv-fg', T.fg)}]`,
    'transition-colors',
  ].join(' '),
  current: [`text-[${v('sv-fg', T.fg)}]`, 'font-medium'].join(' '),
}

export const computeBreadcrumbItemClasses = ({
  state = 'default',
}: {
  state?: BreadcrumbItemState
} = {}): string => BREADCRUMB_ITEM_STATE_CLASS[state]

const BREADCRUMB_SEPARATOR_CLASS = [
  `text-[${v('sv-fg-subtle', T.fgSubtle)}]`,
  'text-sm select-none',
].join(' ')

export const computeBreadcrumbSeparatorClasses = (): string => BREADCRUMB_SEPARATOR_CLASS


const PAGINATION_LIST_LAYOUT = 'flex items-center gap-1'

export const computePaginationListClasses = (): string => PAGINATION_LIST_LAYOUT

const PAGINATION_BUTTON_LAYOUT = [
  'inline-flex items-center justify-center',
  'h-9 min-w-9 px-3 text-sm font-medium',
  'transition-colors',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ')

const PAGINATION_BUTTON_RADIUS = `rounded-[${v('sv-radius-md', T.radiusMd)}]`

const PAGINATION_BUTTON_STATE_CLASS: Record<PaginationButtonState, string> = {
  default: [
    'border',
    `border-[${v('sv-border', T.border)}]`,
    `bg-[${v('sv-bg', T.bg)}]`,
    `text-[${v('sv-fg', T.fg)}]`,
    `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  ].join(' '),
  selected: [
    'border',
    `border-[${v('sv-primary', T.primary)}]`,
    `bg-[${v('sv-primary', T.primary)}]`,
    `text-[${v('sv-primary-fg', T.primaryFg)}]`,
  ].join(' '),
  disabled: [
    'border',
    `border-[${v('sv-border', T.border)}]`,
    `bg-[${v('sv-bg', T.bg)}]`,
    `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  ].join(' '),
}

export const computePaginationButtonClasses = ({
  state = 'default',
}: {
  state?: PaginationButtonState
} = {}): string =>
  [PAGINATION_BUTTON_LAYOUT, PAGINATION_BUTTON_RADIUS, PAGINATION_BUTTON_STATE_CLASS[state]].join(
    ' '
  )

const PAGINATION_ELLIPSIS_CLASS = [
  'inline-flex items-center justify-center',
  'h-9 min-w-9 px-2 text-sm',
  `text-[${v('sv-fg-subtle', T.fgSubtle)}]`,
  'select-none',
].join(' ')

export const computePaginationEllipsisClasses = (): string => PAGINATION_ELLIPSIS_CLASS


const TOC_LINK_LAYOUT = 'block py-0.5 text-sm transition-colors'

const TOC_LINK_STATE_CLASS: Record<TocLinkState, string> = {
  default: [`text-[${v('sv-fg-muted', T.fgMuted)}]`, `hover:text-[${v('sv-fg', T.fg)}]`].join(' '),
  active: [`text-[${v('sv-fg', T.fg)}]`, 'font-medium'].join(' '),
}

export const computeTocLinkClasses = ({
  state = 'default',
}: {
  state?: TocLinkState
} = {}): string => [TOC_LINK_LAYOUT, TOC_LINK_STATE_CLASS[state]].join(' ')
