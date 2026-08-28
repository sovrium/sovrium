/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The **Footprint** page — what this instance
 * consumed, and which levers it is running under.
 *
 * `/_admin/footprint` reads one envelope, `GET /api/admin/footprint/overview`,
 * and lays it out in three regions ordered **measured → declared → context**.
 * That order is the page's whole argument, and the captions state it outright:
 *
 *  - **Measured** — figures this binary observed: response grades, page-cache
 *    outcomes, and the process's own CPU and memory.
 *  - **Storage** — measured too, and the one region where every row must cite
 * the instrument that produced its number ([internal ref] D6 Verification #4). A
 *    byte count with no stated origin is indistinguishable from a fabricated
 *    one, which is exactly what this panel used to ship.
 *  - **Configuration** — the `ECO_*` levers. DECLARED, not measured: it
 *    describes how the instance is set up, never what it emitted. Keeping this
 *    visually and verbally apart from the measured regions is what stops the
 *    page reading as a badge.
 *
 * It is deliberately NOT an ecoconception score. RGESN evaluates a design
 * process and produces a product-level fact identical on every install of a
 * given version, so it is published documentation rather than per-instance
 * telemetry; the page closes with one outbound link to that review.
 *
 * DOGFOODING: built entirely from generic components — `kpi` tiles
 * and two system-source `data-table`s — over an endpoint that already exists.
 * No bespoke island. Every tile shares ONE fetch, because `useKpiSystemValue`
 * keys its query on the endpoint alone.
 *
 * ## Two mechanical traps this file is written around
 *
 * 1. **`valuePath` coerces with `Number()`.** A `null` resolves to the neutral
 *    em-dash correctly, but a non-numeric STRING does not: `Number('A')` is
 *    `NaN`, which is also neutral — so a tile bound to `currentGrade` via
 *    `valuePath` would render `—` forever, including when a real grade exists.
 *    The grade tile therefore uses `valueTemplate`, which passes strings
 *    through. This fails silently and typechecks either way.
 * 2. **`data-table` has no static-rows binding.** Both tables must read from
 *    the endpoint; the storage rows and the lever rows are already in the same
 *    envelope, so both do.
 *
 * Neither table carries a `toolbar` block, and that is deliberate rather than an
 * oversight. Four affordances — Filter, Columns, Export and Settings — render
 * unconditionally in `islands/data-table/island/toolbar.tsx`, so the `toolbar`
 * flags cannot switch them off; `export: false` is worse than inert, swapping
 * the scoped system-CSV button for a generic dropdown. Writing a `toolbar` block
 * that suppresses nothing would be config claiming an effect it does not have.
 * Recorded as a platform gap for `[internal ref]`; until it closes,
 * these tables carry the same chrome as every other console table.
 */

import { homeCrumb, wrapInShell } from './dashboard-shell-surface'
import { dataPageIntro } from './data-object-rail'
import type { DataShellOptions } from './data-landing-surface'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/** The single envelope every region on this page reads from. */
const FOOTPRINT_ENDPOINT = '/api/admin/footprint/overview'

/** Where the published RGESN parity review lives on the marketing site. */
const RGESN_REVIEW_URL = 'https://sovrium.com/en/docs/rgesn-parity'

/** The page intro: heading + orienting one-liner. */
function intro(): Component {
  return dataPageIntro(
    'Footprint',
    'What this instance consumed, and the levers it is running under. Every figure below is either measured by this process or declared by you — each region says which.'
  )
}

/** A KPI tile reading one numeric scalar at `valuePath`. */
function tile(
  label: string,
  valuePath: string,
  kpiFormat?: { readonly type: string; readonly options?: Readonly<Record<string, string>> }
): Component {
  return {
    type: 'kpi',
    label,
    dataSource: { system: { endpoint: FOOTPRINT_ENDPOINT, valuePath } },
    ...(kpiFormat ? { kpiFormat } : {}),
  } as unknown as Component
}

/**
 * The provenance caption closing a region.
 *
 * A sibling `text` rather than a slot inside the cards: `kpi` accepts a
 * `content` field at decode time but neither the island nor the card ever reads
 * it, so a caption written there would be silently dropped. One caption per
 * region also reads better than the same sentence repeated on eight cards.
 */
function caption(content: string): Component {
  return {
    type: 'text',
    element: 'p',
    props: { className: 'text-foreground-subtle max-w-3xl pt-3 text-sm' },
    content,
  } as unknown as Component
}

/** A labelled region wrapping its body and closing with its provenance caption. */
function region(label: string, body: readonly Component[], provenance: string): Component {
  return {
    type: 'container',
    element: 'section',
    props: { className: 'pt-8', 'aria-label': label },
    children: [
      {
        type: 'text',
        element: 'h3',
        props: { className: 'pb-4 text-lg font-semibold tracking-tight' },
        content: label,
      },
      ...body,
      caption(provenance),
    ],
  } as unknown as Component
}

/**
 * §1 Measured — response grades, page-cache outcomes, process usage.
 *
 * `Last graded response` is the one tile that cannot use `valuePath`: the value
 * is a letter. Every other tile here is numeric, and the three nullable ones
 * (`meanBytes`, `hitRate`, and the grade) degrade to the neutral em-dash on
 * their own — which is the point of making them nullable rather than defaulting
 * them to `A` and `0`.
 */
function measuredRegion(): Component {
  return region(
    'Measured',
    [
      {
        type: 'container',
        props: { className: 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4' },
        children: [
          {
            type: 'kpi',
            label: 'Last graded response',
            dataSource: {
              system: {
                endpoint: FOOTPRINT_ENDPOINT,
                valueTemplate: '{ecoIndexHeader.currentGrade}',
              },
            },
          } as unknown as Component,
          tile('Responses graded', 'ecoIndexHeader.graded', { type: 'number' }),
          tile('Mean response size', 'ecoIndexHeader.meanBytes', { type: 'bytes' }),
          tile('Cache hit rate', 'pageCache.hitRate', {
            type: 'percentage',
            options: { scale: '100' },
          }),
          tile('Cache size', 'pageCache.bytes', { type: 'bytes' }),
          tile('Memory', 'runtime.rssBytes', { type: 'bytes' }),
          tile('CPU seconds', 'runtime.cpuSeconds', { type: 'number' }),
          tile('Uptime seconds', 'runtime.uptimeSeconds', { type: 'number' }),
        ],
      } as unknown as Component,
    ],
    'Measured by this process since it started; the counters reset when it restarts. Grades read each response’s Content-Length via the X-Eco-Index header — not a Lighthouse or EcoIndex.fr score, which inspect the rendered page. Set ECO_INDEX_HEADER=on to record them. The hit rate counts only renders the cache was offered: signed-in and dynamic requests bypass it, so an instance without anonymous traffic shows — rather than a rate.'
  )
}

/**
 * §2 Storage — top-3 consumers, every row citing its instrument.
 *
 * The `Measured by` column is not decoration. A blank `Size` next to
 * “Not available” means nobody sized the thing; a `0` next to a named
 * instrument means it was sized and found empty. Without the column those two
 * are the same cell.
 */
function storageRegion(): Component {
  return region(
    'Storage',
    [
      {
        type: 'data-table',
        props: { id: 'admin-footprint-storage', 'aria-label': 'Storage consumers' },
        dataSource: {
          system: {
            endpoint: FOOTPRINT_ENDPOINT,
            rowsKey: 'topStorageConsumers',
            idKey: 'name',
          },
        },
        columns: [
          { field: 'name', label: 'Resource' },
          {
            field: 'type',
            label: 'Type',
            valueLabels: { table: 'Database table', bucket: 'Object store' },
          },
          { field: 'bytes', label: 'Size (bytes)', format: 'compact' },
          {
            field: 'measurement',
            label: 'Measured by',
            valueLabels: {
              pg_total_relation_size: 'PostgreSQL catalog',
              sqlite_dbstat: 'SQLite dbstat',
              storage_adapter: 'Storage adapter',
              unavailable: 'Not available',
            },
          },
        ],
        emptyMessage: 'Nothing to size yet',
      } as unknown as Component,
    ],
    'The three largest consumers, measured on request. Each row names the instrument behind its number, because a size with no stated origin cannot be told apart from one nobody took. A blank size means the probe was unavailable — a zero means the resource was measured and is empty.'
  )
}

/**
 * §3 Configuration — the `ECO_*` levers in force.
 *
 * Every row here is a lever that does something: the inert ones were deleted
 * rather than listed. `Source` is what makes the table worth reading — it
 * separates a value you set from one the platform fell back to.
 */
function configurationRegion(): Component {
  return region(
    'Configuration',
    [
      {
        type: 'data-table',
        props: { id: 'admin-footprint-levers', 'aria-label': 'Eco levers' },
        dataSource: {
          system: { endpoint: FOOTPRINT_ENDPOINT, rowsKey: 'levers', idKey: 'name' },
        },
        columns: [
          { field: 'name', label: 'Lever' },
          { field: 'effective', label: 'In force' },
          {
            field: 'source',
            label: 'Decided by',
            valueLabels: {
              explicit: 'You set it',
              'eco-mode': 'ECO_MODE',
              default: 'Platform default',
            },
          },
        ],
        emptyMessage: 'No levers',
      } as unknown as Component,
    ],
    'Read from the environment on every request, so a change takes effect on the next refresh. Configuration is declared, not measured: it describes how this instance is set up, not what it emitted.'
  )
}

/**
 * The closing link to the published RGESN parity review.
 *
 * Outbound rather than a panel: an RGESN result is a product-level fact,
 * identical on every install of a given version, so rendering it per instance
 * would imply it was measured HERE.
 */
function rgesnLink(): Component {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2 pt-8' },
    children: [
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle max-w-3xl text-sm' },
        content:
          'Ecoconception is a design practice, not runtime state, so it is not scored here. How the engine measures against the French référentiel is published once, for every install:',
      } as unknown as Component,
      {
        type: 'link',
        props: {
          href: RGESN_REVIEW_URL,
          target: '_blank',
          rel: 'noopener noreferrer',
          'data-testid': 'admin-footprint-rgesn-link',
          className:
            'text-foreground-subtle hover:text-foreground inline-flex w-fit items-center gap-2 text-sm underline underline-offset-4',
        },
        content: 'How Sovrium measures up against RGESN 2024',
      } as unknown as Component,
    ],
  } as unknown as Component
}

/**
 * Build the Footprint page (`/_admin/footprint`), wrapped in the persistent
 * shell. The breadcrumb anchors it under the console home.
 */
export function buildFootprintPage(options: DataShellOptions): Page {
  return {
    id: 'dashboard-footprint',
    name: 'dashboard-footprint',
    path: '/footprint',
    meta: { title: 'Sovrium — Footprint' },
    components: wrapInShell(
      [intro(), measuredRegion(), storageRegion(), configurationRegion(), rgesnLink()],
      {
        canEdit: options.canEdit,
        appName: options.appName,
        appVersion: options.appVersion,
        breadcrumb: [homeCrumb(options.appName), { label: 'Footprint', href: '/_admin/footprint' }],
      }
    ),
  } as Page
}
