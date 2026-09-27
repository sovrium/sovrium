/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  arrowLink,
  asComponent,
  DATA_NOTE,
  flex,
  h2,
  param,
  PLACE_NOTE,
  section,
  stack,
  stringParam,
  THEME_NOTE,
  wrap,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** The three newest posts as cards: cover, date, title and excerpt. */
const postsGallery = (p: (key: string) => string): Readonly<Record<string, unknown>> => ({
  type: 'gallery',
  dataSource: {
    table: p('table'),
    sort: [{ field: p('dateField'), direction: 'desc' }],
    limit: 3,
  },
  layout: 'grid',
  gridColumns: { mobile: 1, md: 2, lg: 3 },
  emptyMessage: p('emptyMessage'),
  galleryCard: {
    coverImage: `$record.${p('coverField')}`,
    aspectRatio: '16:10',
    children: [
      {
        type: 'text',
        element: 'span',
        props: { className: 'font-mono text-sm text-foreground-subtle' },
        content: `$record.${p('dateField')}`,
      },
      {
        type: 'text',
        element: 'h3',
        props: { className: 'text-lg font-semibold text-foreground' },
        content: `$record.${p('titleField')}`,
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'line-clamp-2 text-md text-foreground-muted' },
        content: `$record.${p('excerptField')}`,
      },
    ],
    onClick: { type: 'navigate', path: p('postHref') },
  },
})

/** The three latest posts, read from your posts table, as cards. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'blog-cards',
  title: 'Latest posts as cards',
  category: 'marketing',
  tags: ['blog', 'posts', 'articles', 'news', 'cards'],
  description:
    'A section of the three most recent posts from your posts table — cover, date, title and excerpt — with a link to every post. Nothing is typed twice.',
  notes: [
    PLACE_NOTE,
    DATA_NOTE,
    'The posts are sorted by the date field, newest first. A post with no cover is drawn without a picture; the section says so plainly when the table holds no post yet.',
    '`postHref` is the page a card opens; `$record.id` in it is replaced by the post’s id.',
    THEME_NOTE,
  ],
  params: [
    stringParam('headline', 'The heading of the section.', '[From the blog]'),
    stringParam('allLabel', 'The text of the link to every post. Empty to omit.', '[All posts]'),
    stringParam('allHref', 'Where the link to every post points.', '/blog'),
    stringParam('table', 'The table the posts are read from.', 'posts'),
    stringParam('titleField', 'The text field holding each title.', 'title'),
    stringParam('excerptField', 'The text field holding each excerpt.', 'excerpt'),
    stringParam('coverField', 'The URL field holding each cover image.', 'cover'),
    stringParam('dateField', 'The date field the posts are sorted by.', 'published_at'),
    stringParam('postHref', 'The page a card opens.', '/blog/$record.id'),
    stringParam(
      'emptyMessage',
      'What the section says when there is no post.',
      'No post published yet.'
    ),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'title', param: 'titleField', type: 'single-line-text' },
        { name: 'excerpt', param: 'excerptField', type: 'long-text' },
        { name: 'cover', param: 'coverField', type: 'url' },
        { name: 'published_at', param: 'dateField', type: 'date' },
      ],
    },
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
              flex(
                [
                  h2(p('headline')),
                  ...(p('allLabel') === '' ? [] : [arrowLink(p('allLabel'), p('allHref'))]),
                ],
                'flex-wrap items-end justify-between gap-4'
              ),
              postsGallery(p),
            ],
            'gap-10'
          ),
        ]),
      ])
    )
  },
})
