/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  grid,
  param,
  PLACE_NOTE,
  section,
  small,
  stack,
  stringParam,
  THEME_NOTE,
  wrap,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

const slot = (index: number): Readonly<Record<string, unknown>> => ({
  type: 'container',
  props: {
    className:
      'flex h-14 items-center justify-center rounded-lg border border-border bg-background-inset',
  },
  children: [
    {
      type: 'text',
      element: 'span',
      props: { className: 'font-mono text-sm text-foreground-subtle' },
      content: `logo ${index}`,
    },
  ],
})

/** A line of introduction over six logo slots. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'logos-grid',
  title: 'Logo cloud grid',
  category: 'marketing',
  tags: ['logos', 'customers', 'social proof'],
  description:
    'One line of introduction over six evenly spaced slots for the logos of organisations that use the product.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'Each slot is a placeholder. Replace it in the fragment with an `image` of the organisation’s logo — and publish a logo only with that organisation’s permission. Three per row on a phone, six from the large breakpoint up.',
  ],
  params: [
    stringParam(
      'intro',
      'The line above the logos.',
      '[Used by teams at — permission required for each logo]'
    ),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      section(
        [
          wrap([
            stack(
              [
                small(p('intro'), 'text-md text-foreground-muted'),
                grid([1, 2, 3, 4, 5, 6].map(slot), 'w-full grid-cols-3 gap-4 lg:grid-cols-6'),
              ],
              'items-center gap-6 text-center'
            ),
          ]),
        ],
        { className: 'lg:py-16!' }
      )
    )
  },
})
