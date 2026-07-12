/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'


export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

const HEADING_LEVEL_TYPE: Record<HeadingLevel, string> = {
  1: 'text-3xl font-bold tracking-tight',
  2: 'text-xl font-semibold',
  3: 'text-base font-semibold',
  4: 'text-sm font-semibold',
  5: 'text-xs font-semibold uppercase tracking-wider',
  6: 'text-xs font-semibold uppercase tracking-wider',
}

const HEADING_COLOR = `text-[${v('sv-fg', T.fg)}]`

export const computeHeadingClasses = ({ level }: { readonly level: HeadingLevel }): string =>
  [HEADING_LEVEL_TYPE[level], HEADING_COLOR].join(' ')


export type BodyVariant = 'default' | 'lead' | 'muted'

const BODY_VARIANT: Record<BodyVariant, string> = {
  default: [`text-[${v('sv-fg', T.fg)}]`, 'text-base leading-relaxed'].join(' '),
  lead: [`text-[${v('sv-fg-muted', T.fgMuted)}]`, 'text-lg leading-relaxed'].join(' '),
  muted: [`text-[${v('sv-fg-muted', T.fgMuted)}]`, 'text-sm leading-normal'].join(' '),
}

export const computeBodyClasses = ({
  variant = 'default',
}: {
  readonly variant?: BodyVariant
} = {}): string => BODY_VARIANT[variant]


const INLINE_CODE = [
  'font-mono text-sm',
  'px-1 py-0.5',
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `rounded-[${v('sv-radius-sm', T.radiusSm)}]`,
].join(' ')

export const computeInlineCodeClasses = (): string => INLINE_CODE


const CODE_BLOCK = [
  'p-4 overflow-x-auto',
  'font-mono text-xs',
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
].join(' ')

export const computeCodeBlockClasses = (): string => CODE_BLOCK


const BLOCKQUOTE_WRAPPER = [
  'border-l-4 pl-4 italic',
  `border-[${v('sv-border', T.border)}]`,
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
].join(' ')

export const computeBlockquoteClasses = (): string => BLOCKQUOTE_WRAPPER

const BLOCKQUOTE_EMPHASIS = ['font-serif italic', `text-[${v('sv-fg-humane', T.fgHumane)}]`].join(
  ' '
)

export const computeBlockquoteEmphasisClasses = (): string => BLOCKQUOTE_EMPHASIS


const LIST_CONTAINER = 'flex flex-col gap-1'

export const computeListClasses = (): string => LIST_CONTAINER

const LIST_ITEM = [`text-[${v('sv-fg', T.fg)}]`, 'text-base'].join(' ')

export const computeListItemClasses = (): string => LIST_ITEM
