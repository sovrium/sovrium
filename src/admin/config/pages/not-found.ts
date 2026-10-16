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
// the sidebar is still there, the page says what happened, and the one way on
// is the Overview. The status stays 404.
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
      type: 'container',
      element: 'section',
      props: {
        'aria-labelledby': 'admin-not-found-heading',
        className: 'flex flex-col items-start gap-3 py-16',
      },
      children: [
        {
          type: 'text',
          element: 'h1',
          props: {
            id: 'admin-not-found-heading',
            className: 'text-foreground text-2xl font-semibold tracking-tight',
          },
          content: '$t:admin.notFound.heading',
        },
        {
          type: 'text',
          element: 'p',
          props: { className: 'text-muted-foreground max-w-md text-sm' },
          content: '$t:admin.notFound.body',
        },
        {
          type: 'link',
          props: {
            href: '/',
            className:
              'border-border bg-background hover:bg-muted mt-2 inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium text-foreground no-underline',
          },
          content: '$t:admin.notFound.back',
        },
      ],
    } as PageComponent,
  ],
}) satisfies PageConfig
