/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'

/**
 * The surface of one chat turn (shadcn/ui's Bubble), drawn by `type: bubble`
 * and by a `card` with `variant: bubble`.
 *
 * `align` says which side of the thread the turn sits on, and the corner on
 * that side's bottom is square, forming the tail: `start` (the sender, the
 * default) squares the bottom-left corner, `end` (the receiver) the
 * bottom-right one. The tone  is the informational palette, so a bubble reads
 * as conversational chrome distinct from a focal card or a banner.
 */
export type BubbleAlign = 'start' | 'end'

const BUBBLE_LAYOUT = 'px-4 py-3 text-base max-w-md'

const BUBBLE_SURFACE = [
  `bg-[${v('sv-info-bg', T.infoBg)}]`,
  'border',
  `border-[${v('sv-info-border', T.infoBorder)}]`,
  `text-[${v('sv-info-fg', T.infoFg)}]`,
]

/** The tail on the start side: the bottom-left corner square, the other three rounded. */
const BUBBLE_RADIUS_START = [
  `rounded-tl-[${v('radius-md', T.radiusMd)}]`,
  `rounded-tr-[${v('radius-md', T.radiusMd)}]`,
  `rounded-br-[${v('radius-md', T.radiusMd)}]`,
  'rounded-bl-none',
].join(' ')

/** The tail on the end side: the bottom-right corner square. */
const BUBBLE_RADIUS_END = [
  `rounded-tl-[${v('radius-md', T.radiusMd)}]`,
  `rounded-tr-[${v('radius-md', T.radiusMd)}]`,
  `rounded-bl-[${v('radius-md', T.radiusMd)}]`,
  'rounded-br-none',
].join(' ')

/** The default className for a bubble, by the side of the thread it sits on. */
export const computeBubbleClasses = ({
  align = 'start',
}: { readonly align?: BubbleAlign } = {}): string =>
  [
    BUBBLE_LAYOUT,
    ...BUBBLE_SURFACE,
    align === 'end' ? BUBBLE_RADIUS_END : BUBBLE_RADIUS_START,
  ].join(' ')
