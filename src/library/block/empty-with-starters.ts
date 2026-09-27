/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appHeading, appRegion, para, span } from '@/library/manifest/app-block-kit'
import {
  arrowLink,
  asComponent,
  grid,
  param,
  PLACE_NOTE,
  stack,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

const starter = (
  iconName: string,
  title: string,
  description: string,
  href: string
): Readonly<Record<string, unknown>> => ({
  type: 'link',
  props: {
    href,
    className:
      'flex flex-col gap-2 rounded-lg border border-border bg-background-raised p-5 text-foreground hover:border-border-strong hover:bg-background-subtle',
  },
  children: [
    { type: 'icon', props: { name: iconName, size: 20 } },
    span(title, 'mt-2 text-md font-semibold text-foreground'),
    span(description, 'text-sm text-foreground-subtle'),
  ],
})

/** An empty view that offers three ways to start instead of one. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'empty-with-starters',
  title: 'Empty state with starting points',
  category: 'application',
  tags: ['empty state', 'onboarding', 'templates', 'starting point'],
  description:
    'An empty view that offers three starting points as cards, and a quieter link to start from scratch.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'Each card is a link: point it at the page that starts from that template. Edit the three starters in the installed fragment.',
  ],
  params: [
    stringParam('title', 'The heading of the empty view.', 'Start your first automation'),
    stringParam(
      'description',
      'One line under the heading.',
      'Pick a starting point. You can change every step afterwards.'
    ),
    stringParam(
      'scratchLabel',
      'The text of the link that starts from nothing.',
      'Start from scratch'
    ),
    stringParam('scratchHref', 'Where that link points.', '/automations/new'),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      appRegion([
        stack(
          [appHeading(p('title')), para(p('description'), 'text-md text-foreground-muted')],
          'max-w-2xl gap-2'
        ),
        grid(
          [
            starter(
              'bell',
              'When a record is created',
              'Notify a person or a channel.',
              '/automations/new?start=record'
            ),
            starter(
              'clock',
              'On a schedule',
              'Run every day, week or month.',
              '/automations/new?start=schedule'
            ),
            starter(
              'mail',
              'When a form is sent',
              'Reply, and file the answer.',
              '/automations/new?start=form'
            ),
          ],
          'mt-6 max-w-4xl gap-3 sm:grid-cols-3'
        ),
        {
          type: 'container',
          props: { className: 'mt-6' },
          children: [arrowLink(p('scratchLabel'), p('scratchHref'))],
        },
      ])
    )
  },
})
