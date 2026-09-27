/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  icon,
  param,
  person,
  PLACE_NOTE,
  section,
  stack,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** One large quote, centred, with the person who said it. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'testimonial-single',
  title: 'Single highlighted testimonial',
  category: 'marketing',
  tags: ['testimonials', 'quote', 'social proof'],
  description:
    'One quote set large and centred, under a quotation mark and above the person’s name and role.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'Publish a quote only with the person’s permission. Set `initials` to theirs, or edit the fragment to give the avatar a photo `src`.',
  ],
  params: [
    stringParam(
      'quote',
      'The quotation, without the quotation marks.',
      '[One quote, specific enough that only this customer could have said it.]'
    ),
    stringParam('author', 'The name of the person quoted.', '[Full name]'),
    stringParam('role', 'Their role and organisation.', '[Role, organisation]'),
    stringParam('initials', 'The initials drawn in the avatar.', 'AB'),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      section([
        stack(
          [
            icon('quote', 'text-foreground-subtle', 30),
            {
              type: 'text',
              element: 'blockquote',
              props: {
                className:
                  'text-2xl font-medium leading-snug tracking-tight text-balance text-foreground sm:text-3xl',
              },
              content: `“${p('quote')}”`,
            },
            person(p('author'), p('role'), 'lg', p('initials')),
          ],
          'mx-auto max-w-3xl items-center gap-6 text-center'
        ),
      ])
    )
  },
})
