/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The console's own 404: an address inside the console that matches no page.
//
// A signed-in operator who follows a stale link — a section the app no longer
// declares, a typo, a bookmark from an older release — stays INSIDE the console:
// the sidebar is still there, the page says what happened, and the ways on are
// the Overview and the search. The status stays 404.
//
// A caller who is not signed in never sees this page. Every console address
// answers them the bare 404 any unknown path gets, so the page cannot be used
// to learn that a console is mounted here.

import { consolePage } from '../components/data-page'
import type { Page as PageConfig } from '@/domain/models/app'

type PageComponent = NonNullable<PageConfig['components']>[number]

export default consolePage({
  id: 'dashboard-not-found',
  path: '/404',
  title: '$t:admin.meta.notFound',
  shell: {
    // The page is drawn at `/404` whatever address was asked for, so its trail
    // names what happened rather than the number.
    breadcrumb: { '404': '$t:admin.notFound.heading' },
    breadcrumbUnlinked: ['404'],
  },
  body: [
    {
      // shadcn's Empty: the media, the title and the description centred in a
      // dashed-free frame, then the ways on. The page is drawn at `/404`
      // whatever address was asked for, so it cannot echo that address.
      type: 'container',
      element: 'section',
      props: {
        'aria-labelledby': 'admin-not-found-heading',
        'data-slot': 'empty',
        className:
          'flex min-h-[60svh] w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-xl p-6 text-center text-balance',
      },
      children: [
        {
          type: 'container',
          element: 'div',
          props: {
            'data-slot': 'empty-header',
            className: 'flex max-w-sm flex-col items-center gap-2',
          },
          children: [
            {
              type: 'text',
              element: 'span',
              props: {
                'data-slot': 'empty-media',
                'data-variant': 'icon',
                'aria-hidden': 'true',
                className:
                  'mb-2 flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg bg-muted px-2 text-sm font-medium tabular-nums text-foreground',
              },
              content: '404',
            },
            {
              type: 'text',
              element: 'h1',
              props: {
                id: 'admin-not-found-heading',
                'data-slot': 'empty-title',
                className: 'text-lg font-medium tracking-tight text-foreground',
              },
              content: '$t:admin.notFound.heading',
            },
            {
              type: 'text',
              element: 'p',
              props: {
                'data-slot': 'empty-description',
                className: 'text-sm/relaxed text-muted-foreground',
              },
              content: '$t:admin.notFound.body',
            },
          ],
        },
        {
          type: 'container',
          element: 'div',
          props: {
            'data-slot': 'empty-content',
            className: 'flex w-full max-w-sm min-w-0 flex-wrap items-center justify-center gap-2',
          },
          children: [
            {
              type: 'link',
              props: {
                href: '/',
                className:
                  'inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground no-underline hover:bg-primary/80',
              },
              content: '$t:admin.notFound.back',
            },
            {
              type: 'button',
              variant: 'outline',
              size: 'sm',
              props: {
                type: 'button',
                'data-command-palette-trigger': 'true',
                'aria-label': '$t:admin.shell.search',
                className: 'gap-2',
              },
              children: [
                {
                  type: 'text',
                  element: 'span',
                  content: '$t:admin.shell.search',
                },
                { type: 'kbd', keys: ['⌘', 'K'] },
              ],
            },
          ],
        },
      ],
    } as PageComponent,
  ],
}) satisfies PageConfig
