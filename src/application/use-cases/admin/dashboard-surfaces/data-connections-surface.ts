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

const CONNECTIONS_GRID_ID = 'admin-connections-grid'

const oauthAuthorizeAction = {
  type: 'fetch',
  mode: 'oauth',
  method: 'POST',
  url: '/api/admin/connections/$record.id/authorize',
  redirectKey: 'authorizationUrl',
  callbackPath: '/api/admin/connections/$record.name/callback',
} as const

const CONNECTIONS_COLUMNS = [
  { field: 'name', label: 'Connexion' },
  { field: 'provider', label: 'Fournisseur' },
  {
    field: 'type',
    label: 'Type',
    valueLabels: { oauth2: 'OAuth2', apiKey: 'Clé API', basic: 'Basique', bearer: 'Bearer' },
  },
  {
    field: 'status',
    label: 'Statut',
    valueLabels: { active: 'Actif', 'expiring-soon': 'Expire bientôt', expired: 'Expiré' },
    cellStyle: [
      {
        when: { eq: 'active' },
        className: 'bg-success-bg text-success-fg rounded-full px-2 py-0.5 text-xs',
      },
      {
        when: { eq: 'expiring-soon' },
        className: 'bg-warning-bg text-warning-fg rounded-full px-2 py-0.5 text-xs',
      },
      {
        when: { eq: 'expired' },
        className: 'bg-error-bg text-error-fg rounded-full px-2 py-0.5 text-xs',
      },
    ],
  },
  {
    field: 'tokenCount',
    label: 'Jetons',
    valueLabels: { '0': 'Aucun jeton', '1': '1 utilisateur', '2': '2 utilisateurs' },
  },
  { field: 'expiresAt', label: 'Expiration', format: 'datetime' },
  { field: 'createdAt', label: 'Créée le', format: 'datetime' },
  {
    type: 'actions',
    label: 'Actions',
    actions: [
      {
        label: 'Connecter',
        visibleWhen: { field: 'rowAction', eq: 'connect' },
        action: oauthAuthorizeAction,
      },
      {
        label: 'Reconnecter',
        visibleWhen: { field: 'rowAction', eq: 'reconnect' },
        action: oauthAuthorizeAction,
      },
      {
        label: 'Déconnecter',
        visibleWhen: { field: 'rowAction', in: ['disconnect', 'reconnect'] },
        confirm: 'Révoquer les jetons de cette connexion ?',
        action: {
          type: 'fetch',
          method: 'POST',
          url: '/api/admin/connections/$record.id/disconnect',
        },
      },
    ],
  },
] as const

function intro(): Component {
  return dataPageIntro(
    'Connexions',
    'Inspectez les connexions de votre application à des services externes et l’état de leurs jetons : actives, sur le point d’expirer ou expirées. Les connexions sont déclarées dans la configuration — ici, on observe leur état réel.'
  )
}

function connectionsDataTable(): Component {
  return {
    type: 'data-table',
    props: {
      id: CONNECTIONS_GRID_ID,
      'aria-label': 'Connexions',
    },
    dataSource: {
      system: {
        endpoint: '/api/admin/connections',
        rowsKey: 'connections',
        idKey: 'id',
      },
    },
    columns: CONNECTIONS_COLUMNS,
    toolbar: { sort: true },
    pagination: { pageSize: 25 },
    emptyMessage: 'Aucune connexion',
  } as unknown as Component
}

export function buildDataConnectionsPage(options: DataShellOptions): Page {
  return {
    id: 'dashboard-data-connections',
    name: 'dashboard-data-connections',
    path: '/connections',
    meta: { title: 'Sovrium — Données · Connexions' },
    components: wrapInShell([intro(), connectionsDataTable()], {
      canEdit: options.canEdit,
      appName: options.appName,
      appVersion: options.appVersion,
      breadcrumb: [
        homeCrumb(options.appName),
        { label: 'Connexions', href: '/_admin/connections' },
      ],
      publishedSnapshot: options.publishedSnapshot ?? {},
    }),
  } as Page
}
