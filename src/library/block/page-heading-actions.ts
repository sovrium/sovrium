/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appRegion, appTitle, plainButton, span } from '@/library/manifest/app-block-kit'
import {
  asComponent,
  flex,
  param,
  PLACE_NOTE,
  stack,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

const meta = (iconName: string, label: string): Readonly<Record<string, unknown>> =>
  flex(
    [
      { type: 'icon', props: { name: iconName, size: 14, className: 'text-foreground-subtle' } },
      span(label, 'text-sm text-foreground-subtle'),
    ],
    'items-center gap-1.5'
  )

const MORE_MENU: Readonly<Record<string, unknown>> = {
  type: 'dropdown-menu',
  triggerLabel: 'More actions',
  menuItems: [
    { label: 'Duplicate', icon: 'copy' },
    { label: 'Mark as sent', icon: 'send' },
    { separator: true },
    { label: 'Delete', icon: 'trash-2', variant: 'destructive' },
  ],
}

/** The top of a record page: where you are, what it is, and what you can do to it. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'page-heading-actions',
  title: 'Page heading with actions',
  category: 'application',
  tags: ['heading', 'page header', 'breadcrumb', 'actions', 'toolbar'],
  description:
    'The top of a record page: a breadcrumb, the record name, three facts about it, and its actions — one primary, one secondary and a menu for the rest.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The buttons carry no action yet: give each an `action` in the installed fragment. The menu holds the actions used less often.',
  ],
  params: [
    stringParam('title', 'The record name, rendered as the page h1.', 'Invoice INV-0142'),
    stringParam('primaryLabel', 'The text of the primary action.', 'Send reminder'),
    stringParam('secondaryLabel', 'The text of the secondary action.', 'Download PDF'),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      appRegion(
        [
          {
            type: 'breadcrumb',
            breadcrumbItems: [
              { label: 'Clients', href: '/clients' },
              { label: 'Atelier Nord', href: '/clients/atelier-nord' },
              { label: 'INV-0142' },
            ],
          },
          flex(
            [
              stack(
                [
                  appTitle(p('title')),
                  flex(
                    [
                      meta('users', 'Atelier Nord'),
                      meta('calendar', 'Due 12 Oct 2026'),
                      { type: 'badge', badgeVariant: 'outline', content: 'Paid' },
                    ],
                    'flex-wrap items-center gap-4'
                  ),
                ],
                'gap-2'
              ),
              flex(
                [
                  plainButton(p('secondaryLabel'), 'outline'),
                  MORE_MENU,
                  plainButton(p('primaryLabel')),
                ],
                'flex-wrap items-center gap-2'
              ),
            ],
            'flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'
          ),
        ],
        'flex flex-col gap-4'
      )
    )
  },
})
