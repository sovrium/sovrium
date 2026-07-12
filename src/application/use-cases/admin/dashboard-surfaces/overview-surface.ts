/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { homeCrumb, wrapInShell } from './dashboard-shell-surface'
import { dataPageIntro } from './data-object-rail'
import type { DataShellOptions } from './data-landing-surface'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

const OVERVIEW_ENDPOINT = '/api/admin/overview'

function intro(): Component {
  return dataPageIntro(
    'Tableau de bord',
    'Une vue d’ensemble de votre application : enregistrements, soumissions, exécutions, comptes, stockage et connexions, en un coup d’œil.'
  )
}

function valuePathTile(
  label: string,
  valuePath: string,
  kpiFormat?: { readonly type: string; readonly options?: Readonly<Record<string, string>> }
): Component {
  return {
    type: 'kpi',
    label,
    dataSource: { system: { endpoint: OVERVIEW_ENDPOINT, valuePath } },
    ...(kpiFormat ? { kpiFormat } : {}),
  } as unknown as Component
}

function overviewBody(): Component {
  return {
    type: 'container',
    element: 'section',
    props: {
      className: 'pt-2',
      'aria-label': 'Vue d’ensemble',
    },
    children: [
      {
        type: 'container',
        props: { className: 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3' },
        children: [
          valuePathTile('Enregistrements', 'records.total', { type: 'number' }),
          valuePathTile('Soumissions', 'submissions.total', { type: 'number' }),
          valuePathTile('Exécutions (24h)', 'runs.recent', { type: 'number' }),
          valuePathTile('Utilisateurs', 'users.total', { type: 'number' }),
          valuePathTile('Stockage', 'storage.totalBytes', { type: 'bytes' }),
          {
            type: 'kpi',
            label: 'Connexions',
            dataSource: {
              system: {
                endpoint: OVERVIEW_ENDPOINT,
                valueTemplate: '{connections.healthy}/{connections.total}',
              },
            },
          } as unknown as Component,
          valuePathTile('Taux de réussite', 'runs.successRate', {
            type: 'percentage',
            options: { scale: '100' },
          }),
        ],
      } as unknown as Component,
    ],
  } as unknown as Component
}

export function buildOverviewPage(options: DataShellOptions): Page {
  return {
    id: 'dashboard-overview',
    name: 'dashboard-overview',
    path: '/',
    meta: { title: 'Sovrium — Tableau de bord' },
    components: wrapInShell([intro(), overviewBody()], {
      canEdit: options.canEdit,
      appName: options.appName,
      appVersion: options.appVersion,
      breadcrumb: [homeCrumb(options.appName)],
      publishedSnapshot: options.publishedSnapshot ?? {},
    }),
  } as Page
}
