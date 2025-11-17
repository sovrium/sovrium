/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'
import type { Component } from '@/domain/models/app/page/sections'
import type { Page } from '@/domain/models/app/pages'

/**
 * Creates version badge component
 */
function createVersionBadge(version: string): Component {
  return {
    type: 'div',
    props: {
      className: 'flex justify-center',
    },
    children: [
      {
        type: 'span',
        props: {
          'data-testid': 'app-version-badge',
          className:
            'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        },
        children: [version],
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
      type: 'h1',
      props: {
        'data-testid': 'app-name-heading',
        className: 'scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl text-center',
      },
      children: [app.name],
    },
    ...(app.description
      ? [
          {
            type: 'p' as const,
            props: {
              'data-testid': 'app-description',
              className: 'text-xl text-muted-foreground text-center',
            },
            children: [app.description],
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
      title: `${app.name} - Powered by Sovrium`,
      description: app.description ?? `Welcome to ${app.name}`,
    },
    sections: [
      {
        type: 'div',
        props: {
          className: 'h-screen overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100',
        },
        children: [
          {
            type: 'div',
            props: {
              className: 'container mx-auto px-4 sm:px-6 lg:px-8 h-full',
            },
            children: [
              {
                type: 'div',
                props: {
                  className: 'flex h-full flex-col items-center justify-center',
                },
                children: [
                  {
                    type: 'div',
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
    },
    sections: [
      {
        type: 'div',
        props: {
          className: 'flex min-h-screen items-center justify-center bg-gray-50',
        },
        children: [
          {
            type: 'div',
            props: {
              className: 'text-center',
            },
            children: [
              {
                type: 'h1',
                props: { className: 'mb-4 text-6xl font-bold text-gray-900' },
                children: ['404'],
              },
              {
                type: 'p',
                props: { className: 'mb-8 text-xl text-gray-600' },
                children: ['Page not found'],
              },
              {
                type: 'link',
                props: {
                  href: '/',
                  className: 'font-medium text-blue-600 hover:text-blue-700',
                },
                children: ['Go back home'],
              },
            ],
          },
        ],
      },
    ],
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
export function createErrorPageConfig(): Page {
  return {
    name: 'error',
    path: '/500',
    meta: {
      lang: 'en-US',
      title: '500 - Internal Server Error',
      description: 'Internal Server Error',
    },
    sections: [
      {
        type: 'div',
        props: {
          className: 'flex min-h-screen items-center justify-center bg-gray-50',
        },
        children: [
          {
            type: 'div',
            props: {
              className: 'text-center',
            },
            children: [
              {
                type: 'h1',
                props: { className: 'mb-4 text-6xl font-bold text-red-600' },
                children: ['500'],
              },
              {
                type: 'p',
                props: { className: 'mb-8 text-xl text-gray-600' },
                children: ['Internal Server Error'],
              },
              {
                type: 'link',
                props: {
                  href: '/',
                  className: 'font-medium text-blue-600 hover:text-blue-700',
                },
                children: ['Go back home'],
              },
            ],
          },
        ],
      },
    ],
  }
}
