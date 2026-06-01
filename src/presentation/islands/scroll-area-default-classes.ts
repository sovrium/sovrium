/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'

export type ScrollAreaOrientation = 'vertical' | 'horizontal'

const SCROLLBAR_BASE =
  'flex touch-none p-0.5 opacity-0 transition-opacity hover:opacity-100 data-[hovering]:opacity-100 data-[scrolling]:opacity-100'

export const computeScrollAreaScrollbarClasses = ({
  orientation,
}: {
  readonly orientation: ScrollAreaOrientation
}): string => [SCROLLBAR_BASE, orientation === 'vertical' ? 'w-2' : 'h-2'].join(' ')

const SCROLLBAR_THUMB = [
  'flex-1',
  `bg-[${v('sv-border-strong', T.borderStrong)}]`,
  `rounded-[${v('sv-radius-full', T.radiusFull)}]`,
].join(' ')

export const computeScrollAreaThumbClasses = (): string => SCROLLBAR_THUMB
