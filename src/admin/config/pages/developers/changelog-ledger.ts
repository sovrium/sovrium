/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The changelog's boot ledger: one row per start whose version or configuration
// changed, as a table an operator scans down and searches.
//
// ─── A TABLE, NOT A STACK OF CARDS ─────────────────────────────────────────
//
// It was a list of cards, one per boot, each with an identity line, a summary
// and a row of facts. That reads well for three boots and badly for thirty: the
// facts an operator compares between starts — the version, the day, the
// engine, how many migrations ran — sat at different horizontal positions on
// every card. In a table each fact is a column, so a change of engine or a run
// of migrations shows up as a break in one column.
//
// The summary is not a column. It is generated from the diff and says what the
// row's counts already say; the release page reads it beside the diff itself.

import { dataTable, STATUS_BADGE, toolbarSearch } from '../../components/data-table-blocks'
import { RELEASES_ENDPOINT } from '../../system-sources'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** The channel the ledger's search box publishes on and its grid listens to. */
const LEDGER_CHANNEL = 'changelog-filter'

/** A count that is zero reads as "none", not as a figure to compare. */
const NONE_WHEN_ZERO = { '0': '—' } as const

/**
 * The ledger's columns, in the order a boot is read: is it the running one,
 * which version, when, how it was started, on which engine, what the engine
 * and the tables did, and the hash an operator quotes.
 *
 * The first column carries no header: it marks the running boot and is blank
 * on every other row, which is what makes the running one findable at a glance.
 */
const LEDGER_COLUMNS = [
  {
    field: 'current',
    label: '',
    width: 90,
    sortable: false,
    valueLabels: { true: '$t:admin.changelog.current', false: '' },
    cellStyle: [{ when: { eq: true }, className: STATUS_BADGE.quiet.positive }],
  },
  { field: 'version', label: '$t:admin.changelog.field.version' },
  // The feed's short instant — `Today 06:00`, `Oct 8, 14:02` — with the year
  // only for another year: the column is scanned for how recent, not read whole.
  { field: 'bootedAt', label: '$t:admin.changelog.field.bootedAt', format: 'day-relative-time' },
  { field: 'bootedBy', label: '$t:admin.changelog.field.bootedBy' },
  // The engine and what it migrated, in words the board uses: "Sovrium 0.39.1",
  // "12 engine migrations applied" — and nothing when no migration ran.
  { field: 'engineLabel', label: '$t:admin.changelog.field.engine' },
  { field: 'engineMigrationsLabel', label: '$t:admin.changelog.migrations.heading' },
  {
    field: 'schemaChangeCount',
    label: '$t:admin.changelog.ddl.heading',
    align: 'right',
    valueLabels: NONE_WHEN_ZERO,
  },
  { field: 'configHash', label: '$t:admin.changelog.field.config' },
  {
    // The drill-down as a button in the tab order, never a row click: see the
    // decisions register, which measured why. No header, like the first
    // column: a column holding one Open control needs no name above it.
    type: 'actions',
    label: '',
    actions: [
      {
        label: '$t:admin.common.open',
        // The hash, not the row id: it is the address an operator reads off a
        // diff and carries to a colleague, and the read resolves it to the
        // newest row carrying it.
        action: { type: 'fetch', mode: 'navigate', url: '/changelog/$record.configHash' },
      },
    ],
  },
]

/**
 * The ledger grid.
 *
 * Search is CLIENT-SIDE: the releases read takes no `?q=` and echoes no
 * `appliedQuery`, and it returns every row the retention keeps, so the grid
 * narrows the rows it holds. No pager for the same reason.
 */
const ledgerGrid = (): PageComponent =>
  dataTable({
    props: { id: 'admin-changelog-ledger', 'aria-label': '$t:admin.changelog.ledger.region' },
    dataSource: {
      system: {
        endpoint: RELEASES_ENDPOINT,
        rowsKey: 'releases',
        idKey: 'id',
        bindTo: LEDGER_CHANNEL,
        sharedFilter: {},
      },
    },
    columns: LEDGER_COLUMNS,
    emptyMessage: '$t:admin.changelog.ledger.empty',
    noMatchMessage: '$t:admin.changelog.ledger.noMatch',
  }) as PageComponent

/** What a row IS, said once, under the ledger. */
const ledgerCaption = (): PageComponent =>
  ({
    type: 'text',
    element: 'p',
    props: { className: 'text-foreground-subtle text-sm' },
    content: '$t:admin.changelog.ledger.blurb',
  }) as PageComponent

/** The search box, for the toolbar row the page composes. */
export const ledgerSearch = (): PageComponent =>
  toolbarSearch(LEDGER_CHANNEL, '$t:admin.changelog.ledger.search')

/** The ledger and the one line under it. */
export const ledgerBody = (): readonly PageComponent[] => [ledgerGrid(), ledgerCaption()]
