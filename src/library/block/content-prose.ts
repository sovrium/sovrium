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
  media,
  param,
  PLACE_NOTE,
  section,
  small,
  stack,
  stringParam,
  THEME_NOTE,
  when,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import type { BlockNode } from '@/library/manifest/block-kit'

/**
 * A body paragraph of the article. No size or leading of its own: the article
 * is a Typeset container, and its paragraphs read at Typeset's scale.
 */
const paragraph = (content: string): BlockNode => ({
  type: 'text',
  element: 'p',
  props: { className: 'text-pretty text-muted-foreground' },
  content,
})

/** A single readable column of long-form prose. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'content-prose',
  title: 'Single-column article',
  category: 'marketing',
  tags: ['content', 'article', 'prose', 'blog post'],
  description:
    'Long-form prose in one column kept at a comfortable measure: label, title, standfirst, paragraphs, a figure with its caption, a section heading and a pull quote.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The article is written into the fragment as `text` components: edit, add or remove paragraphs there. For a whole page of prose, a markdown page body may suit better.',
    'Leave `imageSrc` empty to keep a 16:9 placeholder figure.',
  ],
  params: [
    stringParam('eyebrow', 'A label above the title. Empty to omit.', '[Category · reading time]'),
    stringParam('headline', 'The article title, rendered as the page h1.', '[Article title]'),
    stringParam(
      'standfirst',
      'The one idea the article defends.',
      '[Standfirst: the one idea the article defends.]'
    ),
    stringParam('imageSrc', 'Path or URL of the figure. Empty keeps the placeholder.', ''),
    stringParam(
      'imageAlt',
      'What the figure shows, for screen readers.',
      'Figure illustrating the article'
    ),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      section([
        {
          type: 'container',
          element: 'article',
          // One Typeset container: the body, the section heading and the figure
          // take its scale and rhythm; the eyebrow, title, standfirst and pull
          // quote keep their display classes (a utility wins over Typeset),
          // though the space above the quote is Typeset's.
          props: { className: 'typeset mx-auto w-full max-w-2xl' },
          children: [
            ...when(p('eyebrow'), eyebrow(p('eyebrow'))),
            h1(p('headline'), 'lg:text-5xl'),
            lead(p('standfirst')),
            paragraph(
              '[Body paragraph. A comfortable measure sits between 60 and 75 characters per line, which this column keeps at every width.]'
            ),
            stack(
              [
                media({
                  src: p('imageSrc'),
                  alt: p('imageAlt'),
                  ratio: 'aspect-video',
                  label: 'figure · 16:9',
                }),
                small('[Caption]'),
              ],
              'mt-2 gap-2'
            ),
            {
              type: 'text',
              element: 'h2',
              props: { className: 'font-semibold tracking-tight text-foreground' },
              content: '[Section heading]',
            },
            paragraph('[Paragraph.]'),
            {
              type: 'text',
              element: 'blockquote',
              props: {
                className:
                  'my-2 border-l-2 border-foreground pl-6 text-2xl font-medium leading-snug text-balance text-foreground',
              },
              content: '[A pull quote, lifted from the text.]',
            },
          ],
        },
      ])
    )
  },
})
