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

const USERS_GRID_ID = 'admin-users-grid'

const USERS_COLUMNS = [
  { field: 'email', label: 'E-mail' },
  { field: 'role', label: 'Rôle' },
  {
    field: 'banned',
    label: 'Statut',
    valueLabels: { false: 'actif', true: 'banni' },
    cellStyle: [
      {
        when: { eq: false },
        className: 'bg-success-bg text-success-fg rounded-full px-2 py-0.5 text-xs',
      },
      {
        when: { eq: true },
        className: 'bg-error-bg text-error-fg rounded-full px-2 py-0.5 text-xs',
      },
    ],
  },
  {
    type: 'actions',
    label: 'Actions',
    actions: [
      {
        label: 'Modifier le rôle',
        editSelect: {
          field: 'role',
          label: 'Rôle',
          saveLabel: 'Enregistrer',
          options: [{ value: 'member' }, { value: 'editor' }, { value: 'admin' }],
        },
        action: {
          type: 'fetch',
          url: '/api/auth/admin/set-role',
          method: 'POST',
          body: { userId: '$record.id', role: '$record.role' },
          responseEnvelope: 'better-auth',
          onSuccess: { type: 'toast', message: 'Rôle mis à jour', refetch: USERS_GRID_ID },
        },
      },
      {
        label: 'Bannir',
        visibleWhen: { field: 'banned', eq: false },
        confirm: {
          title: 'Confirmer le bannissement',
          message: 'Ce compte perdra immédiatement son accès. Vous pourrez lever le bannissement.',
          role: 'alertdialog',
          confirmLabel: 'Confirmer le bannissement',
          cancelLabel: 'Annuler',
        },
        action: {
          type: 'fetch',
          url: '/api/auth/admin/ban-user',
          method: 'POST',
          body: { userId: '$record.id' },
          responseEnvelope: 'better-auth',
          onSuccess: { type: 'toast', message: 'Compte banni', refetch: USERS_GRID_ID },
        },
      },
      {
        label: 'Lever le bannissement',
        visibleWhen: { field: 'banned', eq: true },
        action: {
          type: 'fetch',
          url: '/api/auth/admin/unban-user',
          method: 'POST',
          body: { userId: '$record.id' },
          responseEnvelope: 'better-auth',
          onSuccess: { type: 'toast', message: 'Bannissement levé', refetch: USERS_GRID_ID },
        },
      },
    ],
  },
] as const

function intro(): Component {
  return dataPageIntro(
    'Utilisateurs',
    'Gérez les comptes de votre application : recherchez un utilisateur, ajustez son rôle ou suspendez un accès. La création de compte passe par l’API admin (voir Développeurs → API).'
  )
}

function overviewKpi(label: string, valuePath: string): Component {
  return {
    type: 'kpi',
    label,
    dataSource: {
      system: {
        endpoint: '/api/admin/users/overview',
        valuePath,
      },
    },
    kpiFormat: { type: 'number' },
  } as unknown as Component
}

function kpiStrip(): Component {
  return {
    type: 'container',
    element: 'div',
    props: {
      role: 'region',
      'aria-label': 'Indicateurs des utilisateurs',
      className: 'grid grid-cols-1 gap-4 sm:grid-cols-3',
    },
    children: [
      overviewKpi('Comptes', 'totals.users'),
      overviewKpi('Actifs (24 h)', 'totals.active_24h'),
      overviewKpi('Nouveaux (période)', 'totals.new_in_period'),
    ],
  } as unknown as Component
}

function usersDataTable(): Component {
  return {
    type: 'data-table',
    props: {
      id: USERS_GRID_ID,
      'aria-label': 'Utilisateurs',
    },
    dataSource: {
      system: {
        endpoint: '/api/admin/users',
        rowsKey: 'users',
        idKey: 'id',
      },
    },
    columns: USERS_COLUMNS,
    search: { enabled: true, placeholder: 'Rechercher un utilisateur' },
    toolbar: { search: true, export: true, sort: true },
    pagination: { pageSize: 25 },
    emptyMessage: 'Aucun utilisateur pour le moment',
    noMatchMessage: 'Aucun utilisateur ne correspond à « {query} »',
  } as unknown as Component
}

export function buildDataUsersPage(options: DataShellOptions): Page {
  return {
    id: 'dashboard-data-users',
    name: 'dashboard-data-users',
    path: '/users',
    meta: { title: 'Sovrium — Données · Utilisateurs' },
    components: wrapInShell([intro(), kpiStrip(), usersDataTable()], {
      canEdit: options.canEdit,
      appName: options.appName,
      appVersion: options.appVersion,
      breadcrumb: [homeCrumb(options.appName), { label: 'Utilisateurs', href: '/_admin/users' }],
      publishedSnapshot: options.publishedSnapshot ?? {},
    }),
  } as Page
}
