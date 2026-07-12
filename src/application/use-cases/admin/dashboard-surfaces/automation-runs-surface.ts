/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { Component } from '@/domain/models/app/pages/components'

const RUNS_GRID_ID = 'automation-runs-grid'

const RUNS_FILTER_ID = 'automation-runs-filter'

const RUNS_DETAIL_ID = 'automation-runs-detail'

const RUNS_COLUMNS = [
  { field: 'automationName', label: 'Automatisation' },
  {
    field: 'status',
    label: 'État',
    cellStyle: [
      {
        when: { eq: 'Succès' },
        className: 'bg-success-bg text-success-fg rounded-full px-2 py-0.5 text-xs',
      },
      {
        when: { eq: 'Échec' },
        className: 'bg-danger-bg text-danger-fg rounded-full px-2 py-0.5 text-xs',
      },
      {
        when: { eq: 'Partiel' },
        className: 'bg-warning-bg text-warning-fg rounded-full px-2 py-0.5 text-xs',
      },
    ],
  },
  { field: 'startedAt', label: 'Démarrée', format: 'datetime' },
  { field: 'durationMs', label: 'Durée', align: 'right' },
  {
    type: 'actions',
    label: '',
    actions: [
      {
        label: "Voir l'exécution",
        action: { action: 'openDrawer', component: RUNS_DETAIL_ID },
      },
    ],
  },
] as const

function runsDataTable(): Component {
  return {
    type: 'data-table',
    props: {
      id: RUNS_GRID_ID,
      'aria-label': 'Historique des exécutions',
    },
    dataSource: {
      system: {
        endpoint: '/api/admin/automations/runs',
        rowsKey: 'items',
        idKey: 'id',
        bindTo: RUNS_FILTER_ID,
        sharedFilter: { params: ['automationName', 'status'] },
      },
    },
    columns: RUNS_COLUMNS,
    toolbar: { sort: true },
    pagination: { pageSize: 25 },
    emptyMessage: 'Aucune exécution',
  } as unknown as Component
}

function runsFiltersBar(automationNames: ReadonlyArray<string>): Component {
  return {
    type: 'container',
    element: 'div',
    props: {
      id: RUNS_FILTER_ID,
      className: 'mb-4',
      'data-island': 'shared-filter-select',
      'data-island-props': JSON.stringify({ sourceId: RUNS_FILTER_ID, automationNames }),
    },
  } as unknown as Component
}

function runDetailDrawer(): Component {
  return {
    type: 'record-drawer',
    id: RUNS_DETAIL_ID,
    role: 'region',
    props: { title: "Détail de l'exécution" },
    dataSource: {
      system: { endpoint: '/api/admin/automations/runs/:runId', param: 'runId' },
    },
    canEdit: false,
    recordFields: [
      { name: 'automationName', type: 'single-line-text' },
      { name: 'status', type: 'single-line-text' },
      { name: 'startedAt', type: 'single-line-text' },
      { name: 'durationMs', type: 'single-line-text' },
      { name: 'steps', type: 'json', renderAs: 'list' },
      { name: 'error', type: 'long-text', renderAs: 'code' },
    ],
    actions: [
      {
        label: 'Réessayer',
        confirm: 'Confirmer la nouvelle tentative',
        action: {
          type: 'fetch',
          method: 'POST',
          url: '/api/admin/automations/runs/$record.id/retry',
        },
      },
    ],
  } as unknown as Component
}

export function automationRunsBody(automationNames: ReadonlyArray<string>): Component {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'p-6' },
    children: [runsFiltersBar(automationNames), runsDataTable(), runDetailDrawer()],
  } as unknown as Component
}
