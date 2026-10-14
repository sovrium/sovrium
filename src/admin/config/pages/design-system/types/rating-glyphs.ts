/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { PageComponent } from './body-shape'

/**
 * A rating cell, three of five, drawn with the glyph the `rating` renderer
 * draws — lucide's star, filled for each rank reached, primary on muted — and
 * read as "3 of 5" rather than as five shapes.
 */
export const ratingGlyphs = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      role: 'img',
      'aria-label': '3 of 5',
      className: 'inline-flex w-fit items-center gap-0.5 leading-none text-sm',
    },
    children: [1, 2, 3, 4, 5].map(
      (rank) =>
        ({
          type: 'icon',
          props: {
            name: 'star',
            size: 14,
            className: rank <= 3 ? 'text-primary fill-current' : 'text-muted-foreground',
          },
        }) as PageComponent
    ),
  }) as PageComponent
