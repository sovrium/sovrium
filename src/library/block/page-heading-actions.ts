/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appRegion, appTitle, span } from '@/library/manifest/app-block-kit'
import {
  asComponent,
  flex,
  linkButton,
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

/** A menu row that goes somewhere — the only kind a menu row can carry out on its own. */
const goTo = (
  label: string,
  iconName: string,
  path: string,
  extra: Readonly<Record<string, unknown>> = {}
): Readonly<Record<string, unknown>> => ({
  label,
  icon: iconName,
  action: { type: 'navigate', path },
  ...extra,
})

const moreMenu = (p: (key: string) => string): Readonly<Record<string, unknown>> => ({
  type: 'dropdown-menu',
  triggerLabel: 'More actions',
  menuItems: [
    goTo('Edit', 'pencil', p('editHref')),
    goTo('Duplicate', 'copy', p('duplicateHref')),
    { separator: true },
    goTo('Delete', 'trash-2', p('deleteHref'), { variant: 'destructive' }),
  ],
})

/**
 * An action that opens a page, drawn at the application button's height. A
 * link rather than a `button`, so the address is in the markup: it opens in a
 * new tab, reads out as a link, and works before the page has hydrated.
 */
const navButton = (
  label: string,
  path: string,
  tone: 'primary' | 'secondary' = 'primary'
): Readonly<Record<string, unknown>> => linkButton(label, path, tone, 'sm')

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
    'Every action opens a page: the two buttons and each menu row navigate to the address you give them. The menu holds the actions used less often; Delete opens a page that asks before it deletes, because a menu row carries out `navigate` on its own while a change to a record belongs behind its own confirmation.',
    'Replace the breadcrumb, the three facts and the badge with your record: on a record page, `$record.<field>` reads the record the page is bound to.',
  ],
  params: [
    stringParam('title', 'The record name, rendered as the page h1.', 'Invoice INV-0142'),
    stringParam('primaryLabel', 'The text of the primary action.', 'Send reminder'),
    stringParam('primaryHref', 'The page the primary action opens.', '/invoices/inv-0142/remind'),
    stringParam('secondaryLabel', 'The text of the secondary action.', 'Download PDF'),
    stringParam(
      'secondaryHref',
      'The address the secondary action opens.',
      '/invoices/inv-0142.pdf'
    ),
    stringParam('editHref', 'The page the Edit row opens.', '/invoices/inv-0142/edit'),
    stringParam(
      'duplicateHref',
      'The page the Duplicate row opens.',
      '/invoices/new?from=inv-0142'
    ),
    stringParam(
      'deleteHref',
      'The page the Delete row opens; it confirms before deleting.',
      '/invoices/inv-0142/delete'
    ),
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
                  navButton(p('secondaryLabel'), p('secondaryHref'), 'secondary'),
                  moreMenu(p),
                  navButton(p('primaryLabel'), p('primaryHref')),
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
