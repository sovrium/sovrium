/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The end of the console header: the search trigger, the role note and the scheme toggle.
// Identical on every page; every page places it last in the shell's `trail` slot, because a
// slot fills the whole of its node's children. The Keyboard shortcuts dialog the account menu
// opens rides here too, as a closed dialog, BEFORE the scheme toggle: the toggle is the bar's
// last control on every page.

// ── From components/shell.ts (siteHeader) ──────────────────────────────────────
/** The site header of the copy, with this surface's breadcrumb labels. */

import type { AppEncoded as AppConfig } from '@/domain/models/app'

type Template = NonNullable<AppConfig['components']>[number]

// eslint-disable-next-line sovrium/no-double-assertion -- a template that declares inputs writes `$name` where the component type expects a list or an object; each placement is decoded as the page component it produces when the app starts
export const consoleHeaderEnd = {
  name: 'console-header-end',
  type: 'container',
  render: 'transparent',
  props: {
    className: 'ml-auto flex shrink-0 items-center gap-2',
    'data-testid': 'chrome-end',
  },
  children: [
    {
      type: 'button',
      variant: 'outline',
      props: {
        type: 'button',
        'aria-label': '$t:admin.shell.search',
        'data-command-palette-trigger': 'true',
        className:
          'relative size-8 shrink-0 justify-center gap-2 rounded-md px-0 text-sm font-normal text-muted-foreground shadow-none @2xl:w-56 @2xl:justify-start @2xl:px-2',
      },
      children: [
        {
          type: 'icon',
          props: {
            name: 'search',
            size: 16,
          },
        },
        {
          type: 'text',
          element: 'span',
          props: {
            className: 'hidden flex-1 text-left @2xl:inline',
          },
          content: '$t:admin.shell.searchPlaceholder',
        },
        {
          type: 'kbd',
          keys: ['⌘', 'K'],
          props: {
            className: 'hidden @2xl:inline-flex',
          },
        },
      ],
    },
    {
      type: 'text',
      element: 'span',
      visibility: {
        unlessCapability: 'edit-operations',
      },
      props: {
        className:
          'hidden min-w-0 truncate text-xs text-muted-foreground min-[90rem]:block [header>:nth-child(3)>&]:hidden',
        'data-testid': 'read-only-notice',
      },
      content: '$t:admin.shell.readOnly',
    },
    {
      type: 'text',
      element: 'span',
      visibility: {
        unlessCapability: 'edit-operations',
      },
      props: {
        className:
          'hidden shrink-0 text-xs whitespace-nowrap text-muted-foreground md:block min-[90rem]:hidden min-[90rem]:[header>:nth-child(3)>&]:block',
        'data-testid': 'read-only-notice-short',
      },
      content: '$t:admin.shell.readOnlyShort',
    },
    {
      type: 'dialog',
      title: '$t:admin.shortcuts.title',
      description: '$t:admin.shortcuts.description',
      props: {
        id: 'admin-shortcuts-dialog',
      },
      children: [
        {
          type: 'container',
          element: 'div',
          props: {
            className: 'flex flex-col divide-y',
            'data-testid': 'admin-shortcuts',
          },
          children: [
            {
              type: 'container',
              element: 'div',
              props: {
                className: 'flex items-center justify-between gap-4 py-2 text-sm',
              },
              children: [
                {
                  type: 'text',
                  element: 'span',
                  content: '$t:admin.shortcuts.search',
                },
                {
                  type: 'kbd',
                  keys: ['⌘', 'K'],
                },
              ],
            },
            {
              type: 'container',
              element: 'div',
              props: {
                className: 'flex items-center justify-between gap-4 py-2 text-sm',
              },
              children: [
                {
                  type: 'text',
                  element: 'span',
                  content: '$t:admin.shortcuts.sidebar',
                },
                {
                  type: 'kbd',
                  keys: ['⌘', 'B'],
                },
              ],
            },
            {
              type: 'container',
              element: 'div',
              props: {
                className: 'flex items-center justify-between gap-4 py-2 text-sm',
              },
              children: [
                {
                  type: 'text',
                  element: 'span',
                  content: '$t:admin.shortcuts.close',
                },
                {
                  type: 'kbd',
                  keys: ['Esc'],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'theme-toggle',
      variant: 'icon',
      props: {
        'data-testid': 'admin-scheme-toggle',
        className:
          'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4',
      },
    },
  ],
} as unknown as Template
