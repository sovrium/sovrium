/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Footprint — what this instance consumed, and which levers it is running under.
//
// One envelope, `GET /api/admin/footprint/overview`, laid out in three regions
// ordered **measured → measured → declared**. That order is the page's whole
// argument, and each region's closing caption states which kind it is:
//
//   Measured       — figures this binary observed: response grades, page-cache
//                    outcomes, and the process's own CPU and memory.
//   Storage        — measured too, and the one region where every row cites the
// INSTRUMENT that produced its number ([internal ref] D6). A byte
//                    count with no stated origin cannot be told apart from a
//                    fabricated one.
//   Configuration  — the `ECO_*` levers. DECLARED, not measured: how the
//                    instance is set up, never what it emitted. Keeping this
//                    verbally apart from the measured regions is what stops the
//                    page reading as a badge.
//
// Deliberately NOT an ecoconception score. RGESN evaluates a design PROCESS and
// yields a product-level fact identical on every install of a version, so it is
// published documentation rather than per-instance telemetry; the page closes
// with one outbound link to that review.
//
// ─── WHY THIS SURFACE COULD MOVE TO CONFIG AT ALL ──────────────────────────
//
// It never needed a builder. Every region is generic `kpi` tiles and system-
// source `table`s over an endpoint that already exists — no bespoke island,
// no per-request computation. The builder existed only to reach the shell, and
// the shell is config now.
//
// ─── TWO MECHANICAL TRAPS THIS PAGE IS WRITTEN AROUND ──────────────────────
//
// 1. `valuePath` coerces with `Number()`. A `null` resolves to the neutral
//    em-dash correctly, but a non-numeric STRING does not: `Number('A')` is
//    `NaN`, which is ALSO neutral — so a tile bound to `currentGrade` through
//    `valuePath` would render `—` forever, including when a real grade exists.
//    The grade tile therefore uses `valueTemplate`, which passes strings
//    through. This fails silently and typechecks either way.
// 2. A `table` DOES have a static-rows mode — `static-table` folded into it,
//    and a `table` with no `dataSource` draws the rows you write. It is not
//    what these two want: the storage rows and the lever rows are measured,
//    live in the same endpoint envelope, and would go stale the moment they
//    were written down. So both bind.
//
// Neither table carries a `toolbar` block, and that is deliberate. Four
// affordances — Filter, Columns, Export and Settings — render unconditionally in
// the table island, so the `toolbar` flags cannot switch them off, and
// `export: false` is worse than inert (it swaps the scoped system-CSV button for
// a generic dropdown). A `toolbar` block here would be config claiming an effect
// it does not have. Standing platform gap; until it closes these tables carry
// the same chrome as every other console table.

import { FOOTPRINT_ENDPOINT } from '../../system-sources'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/**
 * A KPI tile reading one numeric scalar at `valuePath`.
 *
 * `label` is a LITERAL rather than a `$t:` key: `kpi` is island-hosted, so its
 * schema fields are serialized into `data-island-props` verbatim and a token
 * there ships the raw key into the DOM.
 */
const tile = (
  label: string,
  valuePath: string,
  kpiFormat?: { readonly type: string; readonly options?: Readonly<Record<string, string>> }
): PageComponent =>
  ({
    type: 'kpi',
    label,
    dataSource: { system: { endpoint: FOOTPRINT_ENDPOINT, valuePath } },
    ...(kpiFormat ? { kpiFormat } : {}),
  }) as PageComponent

/**
 * The provenance caption closing a region.
 *
 * A SIBLING `text` rather than a slot inside the cards: `kpi` accepts a
 * `content` field at decode time but neither the island nor the card ever reads
 * it, so a caption written there would be silently dropped. One caption per
 * region also reads better than the same sentence repeated on eight cards.
 */
const caption = (content: string): PageComponent =>
  ({
    type: 'text',
    element: 'p',
    props: { className: 'text-foreground-subtle max-w-3xl pt-3 text-md' },
    content,
  }) as PageComponent

/**
 * A labelled region wrapping its body and closing with its provenance caption.
 *
 * The `pt-8` each region carried is GONE, and the same 32px now comes from the
 * body's `gap-8`. Padding on every region put that space above the FIRST one
 * too, which was invisible under a page title and is a hole under a tab strip —
 * the strip's own hairline already separates the two. A gap spaces siblings and
 * says nothing about what sits above them, which is the shape this wanted.
 */
const region = (label: string, body: readonly PageComponent[], provenance: string): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: { 'aria-label': label },
    children: [
      {
        type: 'text',
        element: 'h3',
        props: { className: 'pb-4 text-xl font-semibold tracking-tight' },
        content: label,
      },
      ...body,
      caption(provenance),
    ],
  }) as PageComponent

/**
 * §1 Measured — response grades, page-cache outcomes, process usage.
 *
 * `Last graded response` is the one tile that cannot use `valuePath`: its value
 * is a LETTER. Every other tile here is numeric, and the three nullable ones
 * (`meanBytes`, `hitRate`, the grade) degrade to the neutral em-dash on their
 * own — which is the point of making them nullable rather than defaulting them
 * to `A` and `0`.
 */
const measuredRegion = (): PageComponent =>
  region(
    '$t:admin.footprint.measured.heading',
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
          },
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
      } as PageComponent,
    ],
    '$t:admin.locked.audit.footprint.measuredProvenance'
  )

/**
 * §2 Storage — top-3 consumers, every row citing its instrument.
 *
 * The `Measured by` column is not decoration. A blank `Size` next to "Not
 * available" means nobody sized the thing; a `0` next to a named instrument
 * means it was sized and found empty. Without the column those two are the same
 * cell.
 */
const storageRegion = (): PageComponent =>
  region(
    '$t:admin.footprint.storage.heading',
    [
      {
        type: 'table',
        props: { id: 'admin-footprint-storage', 'aria-label': '$t:admin.footprint.storage.region' },
        dataSource: {
          system: { endpoint: FOOTPRINT_ENDPOINT, rowsKey: 'topStorageConsumers', idKey: 'name' },
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
      } as PageComponent,
    ],
    '$t:admin.locked.audit.footprint.storageProvenance'
  )

/**
 * §3 Configuration — the `ECO_*` levers in force.
 *
 * Every row here is a lever that does something: the inert ones were deleted
 * rather than listed. `Source` is what makes the table worth reading — it
 * separates a value you set from one the platform fell back to.
 */
const configurationRegion = (): PageComponent =>
  region(
    '$t:admin.footprint.configuration.heading',
    [
      {
        type: 'table',
        props: { id: 'admin-footprint-levers', 'aria-label': '$t:admin.footprint.levers.region' },
        dataSource: { system: { endpoint: FOOTPRINT_ENDPOINT, rowsKey: 'levers', idKey: 'name' } },
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
      } as PageComponent,
    ],
    '$t:admin.locked.audit.footprint.configurationProvenance'
  )

/**
 * The closing link to the published RGESN parity review.
 *
 * OUTBOUND rather than a panel: an RGESN result is a product-level fact,
 * identical on every install of a given version, so rendering it per instance
 * would imply it was measured HERE.
 *
 * An absolute external URL, so the mount's href walk leaves it alone — that walk
 * only moves paths beginning with `/`.
 */
const rgesnLink = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2' },
    children: [
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle max-w-3xl text-md' },
        content: '$t:admin.footprint.rgesn.blurb',
      },
      {
        type: 'link',
        props: {
          href: 'https://sovrium.com/en/docs/rgesn-parity',
          target: '_blank',
          rel: 'noopener noreferrer',
          'data-testid': 'admin-footprint-rgesn-link',
          className:
            'text-foreground-subtle hover:text-foreground inline-flex w-fit items-center gap-2 text-md underline underline-offset-4',
        },
        content: '$t:admin.footprint.rgesn.link',
      },
    ],
  }) as PageComponent

/**
 * The whole footprint body, as ONE component — the Footprint tab of Analytics.
 *
 * ─── WHY THIS FILE NO LONGER DECLARES A PAGE ───────────────────────────────
 *
 * It is the other half of one question. `/pages` reports the audience a running
 * instance served; this reports what serving them cost. An operator reading one
 * is one click from wanting the other, and they were two sidebar rows and two
 * documents apart.
 *
 * `pages.ts` owns both routes now — `/pages` and the RETAINED `/footprint`,
 * which is the same strip opened on this tab. Exporting the body rather than a
 * page is what lets one file answer two addresses with one definition, so the
 * two can never drift into showing different regions under the same caption.
 *
 * The regions, their order and their provenance captions are untouched: this is
 * a move, not a rewrite.
 */
export const footprintBody = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex min-w-0 flex-col gap-8' },
    children: [measuredRegion(), storageRegion(), configurationRegion(), rgesnLink()],
  }) as PageComponent
