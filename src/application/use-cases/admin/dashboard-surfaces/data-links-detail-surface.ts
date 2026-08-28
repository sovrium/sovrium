/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One link's deep-dive — `/_admin/links/{slug}`
 * ([internal ref]..012).
 *
 * The directory answers "which link", this answers "and what happened to it".
 * Every panel here narrows the SAME readers the directory uses by
 * `&event_name={slug}` rather than calling a per-link endpoint of its own —
 * `/api/admin/links/:slug/clicks` would be a second aggregation path over the
 * click store, and the two would eventually disagree ([internal ref] D6). The three
 * breakdowns below therefore add no aggregation code at all: `/referrers`,
 * `/devices` and `/campaigns` already computed them.
 *
 * ─── WHAT THE CONSOLE MAY AND MAY NOT DO HERE ───────────────────────────────
 *
 * It renders a config-declared link's IDENTITY — slug, title, destination,
 * source badge, state, lifecycle window — as VALUES. It does not render the
 * `app.links[]` entry as a config document: no YAML view, no "view source", no
 * copy-as-config, no diff, no history. Showing a runtime object's identity is
 * not a third introspection surface under [internal ref] A1, which bounds surfaces
 * whose subject is the configuration DOCUMENT; `GET /api/admin/automations` has
 * projected `app.automations[]` the same way since before A1 existed.
 *
 * No Edit or Delete affordance is painted, for either source. The mutation
 * endpoints answer 409 for a config-declared slug, and a control the backend
 * refuses is a defect rather than a cosmetic issue ([internal ref] D2); the runtime
 * half of that surface is Phase 2.
 *
 * And no `password`, in any cell or any payload the page fetches — the catalog
 * and detail endpoints do not emit one, which is what makes redaction real
 * rather than cosmetic: masking in the UI would still ship the value to the
 * browser, the proxy and the error tracker ([internal ref] D5).
 *
 * ─── THE QR PREVIEW POINTS AT THE PUBLIC ROUTE ──────────────────────────────
 *
 * `/l/{slug}.svg` — the same address an email or a PDF would embed, not an admin
 * mirror of it. What the operator previews is then exactly what a scanner sees,
 * and there is no second renderer to drift.
 */

import { homeCrumb, wrapInShell } from './dashboard-shell-surface'
import {
  analyticsIsEnabled,
  ANALYTICS_OVERVIEW_ENDPOINT,
  CATALOG_ENDPOINT,
  clickTrendChart,
  kpiTile,
  LINK_PREFIX,
  LINKS_CONSOLE_PATH,
  panelSection,
  systemGrid,
} from './data-links-panels'
import { analyticsQuery, periodSelector, windowCopy } from './data-links-window'
import { dataPageIntro } from './data-object-rail'
import type { DataShellOptions } from './data-landing-surface'
import type { LinksWindow } from './data-links-window'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * The operator-facing name of a link, when the running config declares one.
 *
 * Read from `app.links[]` rather than fetched, because the page heading has to
 * be in the server-rendered document: a heading that appeared only after a
 * client fetch settled would leave the surface briefly nameless, and the
 * breadcrumb beside it would disagree with it.
 *
 * A link minted at runtime is not in the config, so it is headed by its slug.
 * That is honest rather than ideal — the title is right there in the catalog
 * response the definition panel below already fetches — and closing it needs a
 * page-level single-record binding the console does not have yet.
 */
function configuredTitle(app: App, slug: string): string | undefined {
  const declared = (app.links ?? []).find((link) => link.slug === slug)
  const title = declared?.title
  return typeof title === 'string' && title.length > 0 ? title : undefined
}

/** The deep-dive intro: the link's name, then what this page is for. */
function intro(app: App, slug: string): Component {
  return dataPageIntro(
    configuredTitle(app, slug) ?? slug,
    `How ${LINK_PREFIX}${slug} is being used: the clicks it received, where they came from, and what they were browsing with. Its definition and QR code are below.`
  )
}

/** The link's own metrics over the active window. */
function metricsRegion(query: Readonly<Record<string, string>>, active: LinksWindow): Component {
  return {
    type: 'container',
    element: 'section',
    props: { className: 'flex flex-col gap-3 pt-2', 'aria-label': 'Link metrics' },
    children: [
      windowCopy(active),
      {
        type: 'container',
        props: { className: 'grid grid-cols-1 gap-4 sm:grid-cols-3' },
        children: [
          kpiTile('Clicks', ANALYTICS_OVERVIEW_ENDPOINT, 'summary.pageViews', query),
          kpiTile('Unique visitors', ANALYTICS_OVERVIEW_ENDPOINT, 'summary.uniqueVisitors', query),
          kpiTile('Sessions', ANALYTICS_OVERVIEW_ENDPOINT, 'summary.sessions', query),
        ],
      } as unknown as Component,
    ],
  } as unknown as Component
}

/**
 * The definition panel: the catalog row for this one slug.
 *
 * Bound to the catalog narrowed by `?q={slug}` rather than rendered from
 * `app.links[]`, for two reasons. It works for a runtime-minted link, which the
 * config does not know about at all. And `state` comes back DERIVED by the
 * resolver — the same function the redirect handler uses — so this panel cannot
 * report `active` for a link whose visitors are getting a 410, which a
 * second reading of the lifecycle rules here eventually would.
 */
function definitionPanel(slug: string): Component {
  return {
    type: 'data-table',
    props: { id: 'admin-link-definition', 'aria-label': 'Link definition' },
    dataSource: {
      system: {
        endpoint: CATALOG_ENDPOINT,
        rowsKey: 'items',
        idKey: 'slug',
        query: { q: slug },
      },
    },
    columns: [
      { field: 'shortUrl', label: 'Short link' },
      { field: 'destination', label: 'Destination' },
      { field: 'source', label: 'Source', valueLabels: { config: 'Config', db: 'Console' } },
      { field: 'state', label: 'State' },
      { field: 'validFrom', label: 'Starts', format: 'datetime' },
      { field: 'validUntil', label: 'Expires', format: 'datetime' },
    ],
    emptyMessage: 'This link is no longer declared',
  } as unknown as Component
}

/**
 * The QR preview + its download, pointing at the PUBLIC image route.
 *
 * Exactly one image inside the region, deliberately: the download is a plain
 * text link rather than an icon button, so the preview is unambiguously the
 * thing an operator is looking at.
 */
function qrRegion(slug: string): Component {
  const qrUrl = `${LINK_PREFIX}${slug}.svg`
  return {
    type: 'container',
    element: 'section',
    props: {
      'aria-label': 'QR code',
      className:
        'border-border bg-background-raised flex w-fit flex-col items-center gap-3 rounded-lg border p-4',
    },
    children: [
      {
        type: 'image',
        props: {
          src: qrUrl,
          alt: `QR code for ${LINK_PREFIX}${slug}`,
          className: 'h-40 w-40',
          width: 160,
          height: 160,
        },
      },
      {
        type: 'link',
        content: 'Download SVG',
        props: {
          href: qrUrl,
          download: `${slug}-qr.svg`,
          target: '_blank',
          rel: 'noopener noreferrer',
          className: 'text-foreground-muted hover:text-foreground text-xs underline',
        },
      },
    ],
  } as unknown as Component
}

/** Visits + share, the shape every breakdown reader returns. */
const BREAKDOWN_COLUMNS = [
  { field: 'name', label: 'Name' },
  { field: 'count', label: 'Clicks', align: 'right' },
  // The endpoint already returns a scaled percentage (33.33, not 0.3333), and
  // there is no formatter that leaves an already-scaled number alone — so the
  // unit lives in the header rather than being applied twice to the cell.
  { field: 'percentage', label: 'Share %', align: 'right' },
]

/**
 * The three breakdowns, each from a reader that already existed.
 *
 * `idKey` is the row's identity. Where the reader's identity field is NULLABLE
 * (`referrers.domain` is null for direct traffic; every `campaigns.*` field is
 * null for untagged traffic) two such rows would normalize onto the same `id` —
 * `parseSystemEnvelope` maps `row[idKey]` onto `id` with no index fallback. Each
 * reader groups its rows, so the null bucket collapses to at most one row per
 * grid; that is an observed property of the queries rather than a guarantee the
 * schema makes, and it is recorded here so a future grouping change is caught.
 */
function breakdowns(query: Readonly<Record<string, string>>): ReadonlyArray<Component> {
  return [
    systemGrid({
      label: 'Referrers',
      endpoint: '/api/analytics/referrers',
      rowsKey: 'referrers',
      idKey: 'domain',
      columns: [
        { field: 'domain', label: 'Referrer' },
        { field: 'pageViews', label: 'Clicks', align: 'right' },
        { field: 'uniqueVisitors', label: 'Visitors', align: 'right' },
      ],
      emptyMessage: 'No referrers in this period',
      query,
    }),
    systemGrid({
      label: 'Devices',
      endpoint: '/api/analytics/devices',
      rowsKey: 'deviceTypes',
      idKey: 'name',
      columns: BREAKDOWN_COLUMNS,
      emptyMessage: 'No devices recorded in this period',
      query,
    }),
    systemGrid({
      label: 'Campaigns',
      endpoint: '/api/analytics/campaigns',
      rowsKey: 'campaigns',
      idKey: 'campaign',
      columns: [
        { field: 'campaign', label: 'Campaign' },
        { field: 'source', label: 'Source' },
        { field: 'medium', label: 'Medium' },
        { field: 'pageViews', label: 'Clicks', align: 'right' },
      ],
      emptyMessage: 'No tagged campaigns in this period',
      query,
    }),
  ]
}

/**
 * The raw click log for this link.
 *
 * Field names are `snake_case` because THIS reader's projection is snake_case,
 * unlike every other admin endpoint the console binds. That inconsistency is
 * recorded rather than papered over: camelCase bindings render blank cells,
 * which is exactly how it was found.
 */
function clickLog(query: Readonly<Record<string, string>>): Component {
  return systemGrid({
    label: 'Click log',
    endpoint: '/api/analytics/events',
    rowsKey: 'events',
    idKey: 'id',
    columns: [
      { field: 'timestamp', label: 'Recorded', format: 'datetime' },
      { field: 'event_type', label: 'Type' },
      { field: 'session_hash', label: 'Session' },
    ],
    emptyMessage: 'No clicks in this period',
    query,
  })
}

/** The panels that need analytics: the window selector, metrics, and breakdowns. */
function analyticsPanels(slug: string, active: LinksWindow): ReadonlyArray<Component> {
  const query = analyticsQuery(active, slug)
  return [
    periodSelector(`${LINKS_CONSOLE_PATH}/${slug}`, active),
    metricsRegion(query, active),
    clickTrendChart(query),
    panelSection('Audience', [
      {
        type: 'container',
        props: { className: 'grid grid-cols-1 gap-4 lg:grid-cols-3' },
        children: breakdowns(query),
      } as unknown as Component,
    ]),
    panelSection('Click log', [clickLog(query)]),
  ]
}

/** The deep-dive body: definition + QR first, then everything measured. */
function detailBody(app: App, slug: string, active: LinksWindow): Component {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-6 pt-2' },
    children: [
      panelSection('Definition', [definitionPanel(slug), qrRegion(slug)]),
      ...(analyticsIsEnabled(app) ? analyticsPanels(slug, active) : []),
    ],
  } as unknown as Component
}

/**
 * Build one link's deep-dive page, wrapped in the persistent shell. The
 * breadcrumb anchors it under Console / Links.
 */
export function buildDataLinkDetailPage(
  app: App,
  slug: string,
  options: DataShellOptions,
  active: LinksWindow
): Page {
  return {
    id: `dashboard-data-links-${slug}`,
    name: `dashboard-data-links-${slug}`,
    path: `/links/${slug}`,
    meta: { title: `Sovrium — Data · Links · ${slug}` },
    components: wrapInShell([intro(app, slug), detailBody(app, slug, active)], {
      canEdit: options.canEdit,
      appName: options.appName,
      appVersion: options.appVersion,
      breadcrumb: [
        homeCrumb(options.appName),
        { label: 'Links', href: LINKS_CONSOLE_PATH },
        { label: slug },
      ],
    }),
  } as Page
}
