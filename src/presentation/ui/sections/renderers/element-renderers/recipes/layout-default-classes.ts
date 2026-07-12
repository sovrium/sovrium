/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'


export type DividerStyle = 'solid' | 'dashed' | 'dotted'


const CARD_LAYOUT = 'p-4 flex flex-col gap-2'

const CARD_SURFACE = [
  `bg-[${v('sv-bg', T.bg)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
  `shadow-[${v('sv-shadow-sm', T.shadowSm)}]`,
].join(' ')

export const computeCardClasses = (): string => [CARD_LAYOUT, CARD_SURFACE].join(' ')


const DIVIDER_RULE_BORDER = `border-[${v('sv-border', T.border)}]`

export const computeDividerRuleClasses = (): string => DIVIDER_RULE_BORDER

const DIVIDER_LABEL_WRAPPER_LAYOUT = 'flex items-center gap-2 text-xs'

const DIVIDER_LABEL_WRAPPER_SURFACE = `text-[${v('sv-fg-muted', T.fgMuted)}]`

export const computeDividerLabelWrapperClasses = (): string =>
  [DIVIDER_LABEL_WRAPPER_LAYOUT, DIVIDER_LABEL_WRAPPER_SURFACE].join(' ')

const DIVIDER_LABEL_TEXT = [`text-[${v('sv-fg-subtle', T.fgSubtle)}]`, 'select-none'].join(' ')

export const computeDividerLabelTextClasses = (): string => DIVIDER_LABEL_TEXT
