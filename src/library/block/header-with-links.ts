/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  eyebrow,
  flex,
  h1,
  lead,
  param,
  PLACE_NOTE,
  section,
  stack,
  stringParam,
  THEME_NOTE,
  when,
  wrap,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

const jumpLink = (label: string, href: string): Readonly<Record<string, unknown>> => ({
  type: 'link',
  props: {
    href,
    className: 'inline-flex items-center gap-2 text-md text-foreground-muted hover:text-foreground',
  },
  children: [
    { type: 'text', element: 'span', content: label },
    { type: 'icon', props: { name: 'arrow-right', size: 16 } },
  ],
})

/** A left-aligned page header with a row of links to the topics below. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'header-with-links',
  title: 'Page header with jump links',
  category: 'marketing',
  tags: ['header', 'page title', 'inner page', 'navigation'],
  description:
    'A left-aligned page header: label, page name, one sentence, then a hairline and four links to the topics further down.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The four links point at anchors on the same page by default. Edit the fragment to rename, add or remove topics.',
  ],
  params: [
    stringParam('eyebrow', 'The section the page belongs to. Empty to omit.', '[Section name]'),
    stringParam(
      'headline',
      'The page name, rendered as the page h1.',
      'Name the page in a few words'
    ),
    stringParam(
      'subheadline',
      'One sentence under the page name.',
      'One sentence on what the reader will find below.'
    ),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      section([
        wrap([
          stack(
            [
              ...when(p('eyebrow'), eyebrow(p('eyebrow'))),
              h1(p('headline'), 'max-w-3xl'),
              ...when(p('subheadline'), lead(p('subheadline'), 'max-w-2xl')),
              flex(
                [
                  jumpLink('[Topic one]', '#topic-one'),
                  jumpLink('[Topic two]', '#topic-two'),
                  jumpLink('[Topic three]', '#topic-three'),
                  jumpLink('[Topic four]', '#topic-four'),
                ],
                'mt-6 flex-wrap gap-x-8 gap-y-3 border-t border-border pt-5'
              ),
            ],
            'gap-4'
          ),
        ]),
      ])
    )
  },
})
