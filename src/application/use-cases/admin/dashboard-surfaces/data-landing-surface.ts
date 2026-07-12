/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { homeCrumb, wrapInShell } from './dashboard-shell-surface'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

export { isReadyDataPage, readyDataPageLabel } from '@/domain/utils/admin-data-nav'

export interface DataShellOptions {
  readonly canEdit: boolean
  readonly appName?: string
  readonly appVersion?: string
  readonly publishedSnapshot?: Readonly<Record<string, unknown>>
}

function placeholderBody(label: string): ReadonlyArray<Component> {
  return [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-col gap-2 pt-4' },
      children: [
        {
          type: 'text',
          element: 'h2',
          props: { className: 'text-2xl font-semibold tracking-tight' },
          content: label,
        },
        {
          type: 'text',
          element: 'p',
          props: { className: 'text-muted-foreground max-w-2xl' },
          content:
            'Cette destination arrive très bientôt. La navigation est en place ; la page de données sera disponible dans une prochaine mise à jour.',
        },
        {
          type: 'link',
          props: {
            href: '/_admin',
            className:
              'text-warmth-fg w-fit pt-1 text-sm font-medium hover:underline underline-offset-4',
          },
          content: '← Retour aux Données',
        },
      ],
    } as unknown as Component,
  ]
}

export function buildDataPagePlaceholder(
  page: string,
  label: string,
  options: DataShellOptions
): Page {
  return {
    id: `dashboard-data-${page}`,
    name: `dashboard-data-${page}`,
    path: `/${page}`,
    meta: { title: `Sovrium — Données · ${label}` },
    components: wrapInShell(placeholderBody(label), {
      canEdit: options.canEdit,
      appName: options.appName,
      appVersion: options.appVersion,
      breadcrumb: [homeCrumb(options.appName), { label }],
      publishedSnapshot: options.publishedSnapshot ?? {},
    }),
  } as Page
}
