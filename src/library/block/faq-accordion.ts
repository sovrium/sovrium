/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  h2,
  param,
  PLACE_NOTE,
  section,
  stringParam,
  THEME_NOTE,
  wrap,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

const QUESTIONS = [
  '[The question visitors ask first]',
  '[What happens to my data if I leave?]',
  '[Who can see what?]',
  '[How long does it take to start?]',
  '[What does it cost after the first year?]',
] as const

const ANSWER = '[A direct answer in two or three sentences. Link to the page that goes deeper.]'

/** Five questions that open one at a time. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'faq-accordion',
  title: 'FAQ accordion',
  category: 'marketing',
  tags: ['faq', 'questions', 'accordion'],
  description: 'A heading over five questions that open one at a time, the first open on load.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The questions and answers are written into the fragment as accordion items; each item’s `props.id` must stay unique. The accordion is operable from the keyboard.',
  ],
  params: [stringParam('headline', 'The section heading.', 'Questions')],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      section([
        wrap(
          [
            h2(p('headline'), 'sm:text-4xl'),
            {
              type: 'accordion',
              accordionType: 'single',
              defaultOpen: ['question-1'],
              props: { className: 'mt-8' },
              children: QUESTIONS.map((question, index) => ({
                type: 'container',
                element: 'section',
                props: { id: `question-${index + 1}` },
                content: { title: question, body: ANSWER },
              })),
            },
          ],
          'max-w-3xl'
        ),
      ])
    )
  },
})
