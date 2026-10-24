/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  param,
  PLACE_NOTE,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** `sr-only` keeps a line in the accessibility tree without drawing it. */
const SR_ONLY = 'sr-only'

/** The classes of one line: its own when drawn, `sr-only` when kept for screen readers. */
const lineClass = (visibility: string, drawn: string): string =>
  visibility === SR_ONLY ? SR_ONLY : drawn

/** The page's name as its `h1`, and the sentence that says what the page is for. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'page-header',
  shadcnBlock: null,
  title: 'Page header',
  category: 'console',
  tags: ['heading', 'page header', 'title', 'h1', 'description'],
  description:
    'The top of a page: its name as the one `h1` and a sentence under it saying what the page is for. Either line can be kept for screen readers only.',
  notes: [
    'No shadcn counterpart: shadcn/ui draws its page headers inline in each example rather than as a block. This block is that header: an `h1` and a muted sentence.',
    'Set `titleVisibility` to `sr-only` on a page whose top bar already names it: the heading stays in the accessibility tree, so a screen reader can still answer "what page is this?", and nothing is drawn twice. `descriptionVisibility` does the same for the sentence.',
    'Leave `description` empty to draw the title alone.',
    PLACE_NOTE,
    THEME_NOTE,
  ],
  params: [
    stringParam('title', 'The page name, rendered as its h1.', 'Invoices'),
    stringParam(
      'description',
      'One sentence saying what the page is for. Empty to omit.',
      'Every invoice sent this year, newest first.'
    ),
    stringParam(
      'titleVisibility',
      '`visible` to draw the title, `sr-only` to keep it for screen readers only.',
      'visible'
    ),
    stringParam(
      'descriptionVisibility',
      '`visible` to draw the sentence, `sr-only` to keep it for screen readers only.',
      'visible'
    ),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    // A header that draws nothing takes no room either: clipped as a whole, so
    // the column it opens gains no gap above its first drawn section.
    const drawsNothing =
      p('titleVisibility') === SR_ONLY &&
      (p('description') === '' || p('descriptionVisibility') === SR_ONLY)
    return asComponent(name, {
      type: 'container',
      element: 'header',
      props: { className: drawsNothing ? SR_ONLY : 'flex flex-col gap-2' },
      children: [
        {
          type: 'text',
          element: 'h1',
          props: {
            className: lineClass(p('titleVisibility'), 'text-2xl font-semibold tracking-tight'),
          },
          content: p('title'),
        },
        ...(p('description') === ''
          ? []
          : [
              {
                type: 'text',
                element: 'p',
                props: {
                  className: lineClass(
                    p('descriptionVisibility'),
                    'max-w-3xl text-sm text-muted-foreground'
                  ),
                },
                content: p('description'),
              },
            ]),
      ],
    })
  },
})
