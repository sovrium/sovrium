/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { span } from '@/library/manifest/app-block-kit'
import {
  asComponent,
  flex,
  linkButton,
  param,
  PLACE_NOTE,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** A slim top bar: where you are, the search shortcut, and one action. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'app-navbar-command',
  title: 'Application top bar with the search shortcut',
  category: 'application',
  tags: ['navbar', 'top bar', 'breadcrumb', 'command palette', 'shortcut'],
  description:
    'A slim top bar: where the reader is, a reminder of the ⌘K search shortcut, and one primary action.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'Every page already carries the command palette; ⌘K or Ctrl+K opens it. The bar only reminds the reader of the shortcut — it is not a button.',
    'The breadcrumb is written out: edit `breadcrumbItems` for the page the bar sits on.',
  ],
  params: [
    stringParam('ctaLabel', 'The text of the primary action.', 'New'),
    stringParam('ctaHref', 'Where the primary action points.', '/new'),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(name, {
      type: 'container',
      element: 'header',
      props: { className: 'border-b border-border bg-background px-4 sm:px-6' },
      children: [
        flex(
          [
            {
              type: 'breadcrumb',
              separator: '›',
              breadcrumbItems: [{ label: 'Workspace', href: '/' }, { label: 'Invoices' }],
            },
            flex(
              [
                flex(
                  [
                    span('Search', 'text-sm text-foreground-subtle'),
                    { type: 'kbd', keys: ['⌘', 'K'] },
                  ],
                  'hidden items-center gap-2 md:flex'
                ),
                linkButton(p('ctaLabel'), p('ctaHref')),
              ],
              'items-center gap-4'
            ),
          ],
          'h-14 items-center justify-between gap-4'
        ),
      ],
    })
  },
})
