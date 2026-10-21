/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { displayNameOf } from '@/domain/models/app/display-name-service'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Creates version badge component
 */
function createVersionBadge(version: string): Component {
  return {
    type: 'container',
    props: {
      className: 'flex justify-center',
    },
    children: [
      {
        type: 'badge',
        props: {
          'data-testid': 'app-version-badge',
          className:
            'inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        },
        content: version,
      },
    ],
  }
}

/**
 * Creates app content components (version badge, heading, description)
 */
function createHomePageContent(app: App): ReadonlyArray<Component | string> {
  return [
    ...(app.version ? [createVersionBadge(app.version)] : []),
    {
      type: 'text',
      element: 'h1',
      props: {
        'data-testid': 'app-name-heading',
        className: 'scroll-m-20 text-5xl font-extrabold tracking-tight lg:text-6xl text-center',
      },
      content: displayNameOf(app),
    },
    ...(app.description
      ? [
          {
            type: 'text',
            element: 'p',
            props: {
              'data-testid': 'app-description',
              className: 'text-2xl text-muted-foreground text-center',
            },
            content: app.description,
          },
        ]
      : []),
  ]
}

/**
 * Creates a Page configuration for the default home page
 *
 * Renders:
 * - Optional version badge
 * - App name (H1 heading)
 * - Optional app description
 *
 * Layout: Centered vertically and horizontally with max-width constraint
 *
 * @param app - Application data containing name, version, and description
 * @returns Page configuration for DynamicPage rendering
 */
export function createDefaultHomePageConfig(app: App): Page {
  return {
    name: 'home',
    path: '/',
    meta: {
      lang: 'en-US',
      title: `${displayNameOf(app)} - Powered by Sovrium`,
      description: app.description ?? `Welcome to ${displayNameOf(app)}`,
    },
    components: [
      {
        type: 'container',
        props: {
          className: 'bg-background h-screen overflow-hidden',
        },
        children: [
          {
            type: 'container',
            props: {
              className: 'container mx-auto px-4 sm:px-6 lg:px-8 h-full',
            },
            children: [
              {
                type: 'container',
                props: {
                  className: 'flex h-full flex-col items-center justify-center',
                },
                children: [
                  {
                    type: 'container',
                    props: {
                      className: 'w-full max-w-2xl space-y-6 text-center',
                    },
                    children: createHomePageContent(app),
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
}

/**
 * Creates error page section with centered layout
 */
/** A small line under an error page's link, or nothing. */
const footnoteOf = (footnote: string | undefined): ReadonlyArray<Component> =>
  footnote === undefined
    ? []
    : [
        {
          type: 'text',
          element: 'p',
          props: { className: 'mt-8 text-sm text-muted-foreground' },
          content: footnote,
        },
      ]

function createErrorSection(
  code: string,
  message: string,
  codeColor: string = 'text-foreground',
  footnote?: string
): ReadonlyArray<Component> {
  return [
    {
      type: 'container',
      props: {
        className: 'flex min-h-screen items-center justify-center bg-background',
      },
      children: [
        {
          type: 'container',
          props: {
            className: 'text-center',
          },
          children: [
            {
              type: 'text',
              element: 'h1',
              props: {
                className: `mb-4 text-6xl font-bold ${codeColor}`,
              },
              content: code,
            },
            {
              type: 'text',
              element: 'p',
              props: {
                className: 'mb-8 text-2xl text-muted-foreground',
              },
              content: message,
            },
            {
              type: 'link',
              props: {
                href: '/',
                className: 'font-medium text-primary',
              },
              content: 'Go back home',
            },
            ...footnoteOf(footnote),
          ],
        },
      ],
    },
  ]
}

/**
 * Creates a Page configuration for 404 Not Found error page
 *
 * Renders:
 * - Large "404" heading
 * - "Page not found" message
 * - Link to return home
 *
 * Layout: Centered vertically and horizontally
 *
 * @returns Page configuration for DynamicPage rendering
 */
export function createNotFoundPageConfig(): Page {
  return {
    name: 'not_found',
    path: '/404',
    meta: {
      lang: 'en-US',
      title: '404 - Not Found',
      description: 'Page not found',
      // The not-found page must never be indexed.
      robots: 'noindex',
    },
    components: createErrorSection('404', 'Page not found'),
  }
}

/**
 * Creates a Page configuration for 500 Internal Server Error page
 *
 * Renders:
 * - Large "500" heading (red color)
 * - "Internal Server Error" message
 * - Link to return home
 *
 * Layout: Centered vertically and horizontally
 *
 * @returns Page configuration for DynamicPage rendering
 */
export function createErrorPageConfig(requestId?: string): Page {
  return {
    name: 'error',
    path: '/500',
    meta: {
      lang: 'en-US',
      title: '500 - Internal Server Error',
      description: 'Internal Server Error',
    },
    // The request id, so a visitor can quote it to whoever runs the app — and
    // nothing more: the visitor is not the operator, so no report link.
    components: createErrorSection(
      '500',
      'Internal Server Error',
      'text-error-fg',
      requestId === undefined ? undefined : `Request id: ${requestId}`
    ),
  }
}
