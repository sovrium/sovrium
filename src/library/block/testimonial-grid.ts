/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  grid,
  h2,
  param,
  person,
  PLACE_NOTE,
  section,
  stringParam,
  THEME_NOTE,
  wrap,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

const quoteCard = (index: number): Readonly<Record<string, unknown>> => ({
  type: 'card',
  props: { className: 'flex flex-col justify-between gap-6 p-6 sm:p-8' },
  children: [
    {
      type: 'text',
      element: 'blockquote',
      props: { className: 'text-md leading-relaxed text-foreground' },
      content: `“[A specific sentence from customer ${index}: what they did, what changed.]”`,
    },
    person('[Full name]', '[Role, organisation]'),
  ],
})

/** Three quotes in cards, each with the person's name and role. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'testimonial-grid',
  title: 'Grid of testimonials',
  category: 'marketing',
  tags: ['testimonials', 'quotes', 'social proof'],
  description:
    'A heading over three cards, each a quote followed by the person who said it — initials, name and role.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The quotes are placeholders written into the fragment. Publish a quote only with the person’s permission, and replace the initials with a photo through the avatar’s `src` if they agree to one.',
  ],
  params: [stringParam('headline', 'The section heading.', '[What customers say]')],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      section([
        wrap([
          h2(p('headline'), 'sm:text-4xl'),
          grid(
            [quoteCard(1), quoteCard(2), quoteCard(3)],
            'mt-12 gap-4 md:grid-cols-2 lg:grid-cols-3'
          ),
        ]),
      ])
    )
  },
})
