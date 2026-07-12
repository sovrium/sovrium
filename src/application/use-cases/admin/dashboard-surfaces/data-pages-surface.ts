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

const OVERVIEW_ENDPOINT = '/api/analytics/overview'

const PAGES_ENDPOINT = '/api/analytics/pages'

interface AnalyticsWindow {
  readonly from: string
  readonly to: string
  readonly granularity: 'day'
}

function defaultWindow(): AnalyticsWindow {
  const to = new Date()
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
  return { from: from.toISOString(), to: to.toISOString(), granularity: 'day' }
}

function intro(): Component {
  return dataPageIntro(
    'Statistiques',
    'Mesurez l’audience de vos pages : vues, visiteurs uniques et sessions sur les 30 derniers jours, avec l’évolution dans le temps et les pages les plus consultées.'
  )
}

function analyticsDisabledRegion(): Component {
  return {
    type: 'container',
    element: 'section',
    props: {
      'aria-label': 'Statistiques non activées',
      className:
        'border-border bg-background-raised mt-2 flex flex-col items-center gap-2 rounded-lg border p-10 text-center',
    },
    children: [
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground text-sm font-medium' },
        content: 'Les statistiques ne sont pas activées',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-muted max-w-md text-sm leading-relaxed' },
        content:
          'Activez l’analytique dans la configuration de l’application (analytics) pour mesurer l’audience de vos pages, leurs visiteurs et leurs sessions.',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle mt-1 max-w-md font-serif text-sm italic' },
        content: 'Rien à mesurer tant que la mesure dort.',
      },
    ],
  } as unknown as Component
}

function kpiTile(label: string, valuePath: string, w: AnalyticsWindow): Component {
  return {
    type: 'kpi',
    label,
    dataSource: {
      system: {
        endpoint: OVERVIEW_ENDPOINT,
        valuePath,
        query: { from: w.from, to: w.to, granularity: w.granularity },
      },
    },
    kpiFormat: { type: 'number' },
  } as unknown as Component
}

function kpiStrip(w: AnalyticsWindow): Component {
  return {
    type: 'container',
    element: 'section',
    props: { className: 'pt-2', 'aria-label': 'Indicateurs d’audience' },
    children: [
      {
        type: 'container',
        props: { className: 'grid grid-cols-1 gap-4 sm:grid-cols-3' },
        children: [
          kpiTile('Pages vues', 'summary.pageViews', w),
          kpiTile('Visiteurs uniques', 'summary.uniqueVisitors', w),
          kpiTile('Sessions', 'summary.sessions', w),
        ],
      } as unknown as Component,
    ],
  } as unknown as Component
}

function audienceChart(w: AnalyticsWindow): Component {
  return {
    type: 'chart',
    props: { 'aria-label': 'Évolution de l’audience' },
    dataSource: {
      system: {
        endpoint: OVERVIEW_ENDPOINT,
        rowsKey: 'timeSeries',
        query: { from: w.from, to: w.to, granularity: w.granularity },
      },
    },
    chartType: 'area',
    xAxis: { field: 'period', format: 'date' },
    series: [
      { field: 'pageViews', label: 'Pages vues' },
      { field: 'uniqueVisitors', label: 'Visiteurs uniques' },
      { field: 'sessions', label: 'Sessions' },
    ],
    emptyState: {
      role: 'region',
      name: 'Aucune donnée',
      title: 'Aucune visite sur la période',
    },
  } as unknown as Component
}

function topPagesTable(w: AnalyticsWindow): Component {
  return {
    type: 'data-table',
    props: { 'aria-label': 'Pages les plus consultées' },
    dataSource: {
      system: {
        endpoint: PAGES_ENDPOINT,
        rowsKey: 'pages',
        idKey: 'path',
        query: { from: w.from, to: w.to },
      },
    },
    columns: [
      { field: 'path', label: 'Page' },
      { field: 'pageViews', label: 'Vues', align: 'right' },
      { field: 'uniqueVisitors', label: 'Visiteurs', align: 'right' },
    ],
    emptyMessage: 'Aucune page consultée sur la période',
  } as unknown as Component
}

function analyticsBody(w: AnalyticsWindow): Component {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-6 pt-2' },
    children: [kpiStrip(w), audienceChart(w), topPagesTable(w)],
  } as unknown as Component
}

export function buildDataPagesPage(options: DataShellOptions, analyticsEnabled: boolean): Page {
  const body = analyticsEnabled ? analyticsBody(defaultWindow()) : analyticsDisabledRegion()
  return {
    id: 'dashboard-data-pages',
    name: 'dashboard-data-pages',
    path: '/pages',
    meta: { title: 'Sovrium — Données · Statistiques' },
    components: wrapInShell([intro(), body], {
      canEdit: options.canEdit,
      appName: options.appName,
      appVersion: options.appVersion,
      breadcrumb: [homeCrumb(options.appName), { label: 'Statistiques', href: '/_admin/pages' }],
      publishedSnapshot: options.publishedSnapshot ?? {},
    }),
  } as Page
}
