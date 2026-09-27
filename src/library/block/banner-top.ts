/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { span } from '@/library/manifest/app-block-kit'
import { asComponent, param, PLACE_NOTE, stringParam, when } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** One time-bound message across the top of the site. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'banner-top',
  title: 'Top banner',
  category: 'marketing',
  tags: ['banner', 'announcement', 'notice', 'strip'],
  description:
    'A strip across the top of the site: one line on what changed, a link to read more, and a button to dismiss it.',
  notes: [
    PLACE_NOTE,
    'The strip is painted with `--color-primary` and `--color-primary-fg`, so it follows your `theme`.',
    'Dismissing hides the strip on the current page only; it shows again on the next page load. Remove the block when the message expires.',
  ],
  params: [
    stringParam('message', 'The one line of news.', '[What changed, in one line.]'),
    stringParam('linkLabel', 'The text of the link. Empty to omit.', '[Read more]'),
    stringParam('linkHref', 'Where the link points.', '/changelog'),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(name, {
      type: 'alert',
      alertVariant: 'default',
      props: {
        dismissible: true,
        'aria-label': 'Announcement',
        className: 'w-full justify-center text-md',
        style: {
          backgroundColor: 'var(--color-primary)',
          color: 'var(--color-primary-fg)',
          borderColor: 'var(--color-primary)',
          borderRadius: '0',
          borderWidth: '0',
          alignItems: 'center',
          padding: '10px 16px',
        },
      },
      children: [
        {
          type: 'flex',
          props: {
            className: 'flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center',
          },
          children: [
            span(p('message'), ''),
            ...when(p('linkLabel'), {
              type: 'link',
              props: {
                href: p('linkHref'),
                className: 'font-medium underline underline-offset-4',
                style: { color: 'inherit' },
              },
              content: p('linkLabel'),
            }),
          ],
        },
      ],
    })
  },
})
