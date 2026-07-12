/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

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
            'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        },
        content: version,
      },
    ],
  }
}

function createHomePageContent(app: App): ReadonlyArray<Component | string> {
  return [
    ...(app.version ? [createVersionBadge(app.version)] : []),
    {
      type: 'text',
      element: 'h1',
      props: {
        'data-testid': 'app-name-heading',
        className: 'scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl text-center',
      },
      content: app.name,
    },
    ...(app.description
      ? [
          {
            type: 'text',
            element: 'p',
            props: {
              'data-testid': 'app-description',
              className: 'text-xl text-muted-foreground text-center',
            },
            content: app.description,
          },
        ]
      : []),
  ]
}

export function createDefaultHomePageConfig(app: App): Page {
  return {
    name: 'home',
    path: '/',
    meta: {
      lang: 'en-US',
      title: `${app.name} - Powered by Sovrium`,
      description: app.description ?? `Welcome to ${app.name}`,
    },
    components: [
      {
        type: 'container',
        props: {
          className: 'h-screen overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100',
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

function createErrorSection(
  code: string,
  message: string,
  codeColor: string = 'text-foreground'
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
                className: 'mb-8 text-xl text-muted-foreground',
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
          ],
        },
      ],
    },
  ]
}

export function createNotFoundPageConfig(): Page {
  return {
    name: 'not_found',
    path: '/404',
    meta: {
      lang: 'en-US',
      title: '404 - Not Found',
      description: 'Page not found',
      robots: 'noindex',
    },
    components: createErrorSection('404', 'Page not found'),
  }
}

export function createErrorPageConfig(): Page {
  return {
    name: 'error',
    path: '/500',
    meta: {
      lang: 'en-US',
      title: '500 - Internal Server Error',
      description: 'Internal Server Error',
    },
    components: createErrorSection('500', 'Internal Server Error', 'text-red-600'),
  }
}
