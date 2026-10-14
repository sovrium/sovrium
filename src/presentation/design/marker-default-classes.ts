/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { cva } from 'class-variance-authority'

/**
 * Adapted from shadcn/ui marker (https://ui.shadcn.com), registry commit 3464245c4513.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The `marker` anatomy (`marker`, `marker-icon`, `marker-content`), base-nova's
 * own strings. The separator variant draws its two rules as the root's
 * `before`/`after` pseudo-elements, and the content stops flexing so the words
 * sit centred between them.
 */
export type MarkerVariant = 'default' | 'border' | 'separator'

const MARKER_BASE =
  "group/marker relative flex min-h-4 w-full items-center gap-2 text-left text-sm text-muted-foreground [&_svg:not([class*='size-'])]:size-4 [a]:underline [a]:underline-offset-3 [a]:hover:text-foreground"

const MARKER_VARIANTS = cva('', {
  variants: {
    variant: {
      default: '',
      separator:
        'before:mr-1 before:h-px before:min-w-0 before:flex-1 before:bg-border after:ml-1 after:h-px after:min-w-0 after:flex-1 after:bg-border',
      border: 'border-b border-border pb-2',
    },
  },
})

/** `marker`: the root, by variant. */
export const computeMarkerClasses = (variant: MarkerVariant = 'default'): string =>
  `${MARKER_BASE} ${MARKER_VARIANTS({ variant: variant })}`.trim()

/** `marker-icon`: the decorative glyph before the words. */
export const computeMarkerIconClasses = (): string =>
  "size-4 shrink-0 [&_svg:not([class*='size-'])]:size-4"

/** `marker-content`: the words, centred between the rules of a separator. */
export const computeMarkerContentClasses = (): string =>
  'min-w-0 wrap-break-word group-data-[variant=separator]/marker:flex-none group-data-[variant=separator]/marker:text-center *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground'
