/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  eyebrow,
  h1,
  lead,
  param,
  PLACE_NOTE,
  section,
  stack,
  stringParam,
  THEME_NOTE,
  when,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** The top of an inner page: a label, the page name and one sentence, centred. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'header-centered',
  title: 'Centered page header',
  category: 'marketing',
  tags: ['header', 'page title', 'inner page'],
  description:
    'The top of an inner page: a section label, the page name and one sentence on what follows.',
  notes: [PLACE_NOTE, THEME_NOTE],
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
      'One sentence on what the reader will find below, and who it is for.'
    ),
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
            ...when(p('eyebrow'), eyebrow(p('eyebrow'))),
            h1(p('headline')),
            ...when(p('subheadline'), lead(p('subheadline'))),
          ],
          'mx-auto max-w-3xl items-center gap-4 text-center'
        ),
      ])
    )
  },
})
