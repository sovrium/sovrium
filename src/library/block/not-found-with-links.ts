/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { span } from '@/library/manifest/app-block-kit'
import {
  asComponent,
  h1,
  lead,
  param,
  PLACE_NOTE,
  section,
  stack,
  stringParam,
  THEME_NOTE,
  wrap,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

const destination = (
  iconName: string,
  title: string,
  description: string,
  href: string
): Readonly<Record<string, unknown>> => ({
  type: 'link',
  props: {
    href,
    className:
      'flex items-center gap-4 border-b border-border py-4 text-foreground hover:bg-background-subtle focus-visible:outline-2 focus-visible:outline-offset-2',
  },
  children: [
    {
      type: 'icon',
      props: { name: iconName, size: 20, className: 'flex-none text-foreground-subtle' },
    },
    {
      type: 'flex',
      props: { className: 'flex min-w-0 flex-1 flex-col' },
      children: [
        span(title, 'text-md font-semibold text-foreground'),
        span(description, 'text-sm text-foreground-subtle'),
      ],
    },
    {
      type: 'icon',
      props: { name: 'chevron-right', size: 18, className: 'flex-none text-foreground-subtle' },
    },
  ],
})

/** A not-found page that lists the pages people usually look for. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'not-found-with-links',
  title: 'Not-found page with useful links',
  category: 'marketing',
  tags: ['404', 'not found', 'error page', 'links'],
  description:
    'A not-found page that admits the dead link and offers the three destinations readers usually want, each with one line on what is there.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'Set each destination with its three parameters — label, line and address — to the pages your readers look for most.',
  ],
  params: [
    stringParam('headline', 'The heading, rendered as the page h1.', 'Nothing here'),
    stringParam(
      'subheadline',
      'One sentence under the heading.',
      'These are the pages people usually look for.'
    ),
    stringParam('firstLabel', 'The first destination.', 'Home'),
    stringParam(
      'firstLine',
      'One line on what the first destination offers.',
      '[What the home page offers]'
    ),
    stringParam('firstHref', 'The address of the first destination.', '/'),
    stringParam('secondLabel', 'The second destination.', '[Docs]'),
    stringParam(
      'secondLine',
      'One line on what the second destination offers.',
      '[What the reader finds there]'
    ),
    stringParam('secondHref', 'The address of the second destination.', '/docs'),
    stringParam('thirdLabel', 'The third destination.', '[Contact]'),
    stringParam('thirdLine', 'One line on what the third destination offers.', '[Who answers]'),
    stringParam('thirdHref', 'The address of the third destination.', '/contact'),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      section(
        [
          wrap(
            [
              stack(
                [
                  span('404', 'font-mono text-md text-foreground-subtle'),
                  h1(p('headline')),
                  lead(p('subheadline')),
                  {
                    type: 'container',
                    element: 'nav',
                    props: {
                      'aria-label': 'Suggested pages',
                      className: 'mt-6 flex flex-col border-t border-border',
                    },
                    children: [
                      destination('house', p('firstLabel'), p('firstLine'), p('firstHref')),
                      destination('file-text', p('secondLabel'), p('secondLine'), p('secondHref')),
                      destination('mail', p('thirdLabel'), p('thirdLine'), p('thirdHref')),
                    ],
                  },
                ],
                'gap-4'
              ),
            ],
            'max-w-xl'
          ),
        ],
        { element: 'main' }
      )
    )
  },
})
