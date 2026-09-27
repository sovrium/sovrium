/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { span } from '@/library/manifest/app-block-kit'
import {
  actions,
  asComponent,
  h1,
  lead,
  linkButton,
  param,
  PLACE_NOTE,
  section,
  stack,
  stringParam,
  THEME_NOTE,
  when,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** A centered not-found message with a way back. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'not-found-centered',
  title: 'Centered not-found page',
  category: 'marketing',
  tags: ['404', 'not found', 'error page'],
  description:
    'A dead link, admitted plainly: the code, a headline, one sentence on why, and two ways back.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'Use it on the page your app serves for unknown addresses. Set `secondaryLabel` to an empty string to keep a single way back.',
  ],
  params: [
    stringParam('headline', 'The heading, rendered as the page h1.', 'This page does not exist'),
    stringParam(
      'subheadline',
      'One sentence on why the reader landed here.',
      'The link may be old, or the address mistyped.'
    ),
    stringParam('ctaLabel', 'The text of the main way back.', 'Back to home'),
    stringParam('ctaHref', 'Where the main way back points.', '/'),
    stringParam('secondaryLabel', 'The text of the second link. Empty to omit.', '[Contact]'),
    stringParam('secondaryHref', 'Where the second link points.', '/contact'),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      section(
        [
          stack(
            [
              span('404', 'font-mono text-md text-foreground-subtle'),
              h1(p('headline')),
              lead(p('subheadline'), 'max-w-md'),
              actions(
                [
                  linkButton(p('ctaLabel'), p('ctaHref')),
                  ...when(
                    p('secondaryLabel'),
                    linkButton(p('secondaryLabel'), p('secondaryHref'), 'secondary')
                  ),
                ],
                'mt-4 w-full sm:w-auto sm:justify-center'
              ),
            ],
            'mx-auto max-w-2xl items-center gap-4 text-center'
          ),
        ],
        { element: 'main', className: 'flex min-h-[70vh] items-center justify-center' }
      )
    )
  },
})
