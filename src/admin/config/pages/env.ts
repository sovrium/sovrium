/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Environment — which declared `app.env[]` variables this instance resolved,
// and from which rung. Never a value, and never a `process.env` dump.
//
// ─── A TABLE, WITH SEARCH AND TWO FACETS ───────────────────────────────────
//
// One row per declared variable: its key, where the configuration uses it,
// whether it is required, whether this instance resolved a value, and from
// which rung — shadcn's data table with its search box. The list it replaced read as a
// stack of sentences an operator had to read one by one to find the unset one.

// ─── WHY THE ENDPOINT GREW A FIELD ─────────────────────────────────────────
//
// `visibility.record` evaluates ONE field against one operator. It has no
// conjunction and — measured, not assumed — no presence test: `exists` decodes
// and is then DROPPED (`visibility.test.ts`, "DROPS an operator outside the
// shared vocabulary"), leaving a predicate that matches everything. So
// "a default is declared AND its literal is withheld" — the row hint that earns
// this page for the credential-shaped majority — was not expressible over
// `hasDefault` x `defaultValue`.
//
// `defaultState` collapses the two into the one three-way fact a declarative
// reader can gate on. It is a derived FACT, not a label: no English crosses the
// wire, and the copy below stays here. `hasDefault` and `defaultValue` keep
// their exact meanings for every existing consumer.
//
// ─── STATUS IS QUIET, EXCEPT WHEN A REQUIRED VALUE IS MISSING ──────────────
//
// The set/unset indicator is weight and de-emphasis, never a green/amber pill.
// A console that paints "not set" amber implies the operator did something
// wrong; most unset variables are optional and unset on purpose. The one
// exception is the console-wide LOUD state (`STATUS_BADGE.loud`): a variable
// the app REQUIRES and does not have.
//
// ─── NO VALUE, NO CONTROL ([internal ref] A1) ─────────────────────────────────────
//
// No edit affordance, no write endpoint, no reveal. The page binds one READ and
// renders it. Values are configured in the deployment environment, and the
// sentence under the table says so, so an operator who came here to fix one knows where
// to go.

import { consolePage, pageHeading } from '../components/data-page'
import { dataTable, STATUS_BADGE, toolbarSearch } from '../components/data-table-blocks'
import { ENV_ENDPOINT } from '../system-sources'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** A plain text node — the recurring leaf of the alert's rows. */
const text = (element: string, className: string, content: string): PageComponent =>
  ({ type: 'text', element, props: { className }, content }) as PageComponent

const header = (): PageComponent =>
  pageHeading('$t:admin.env.heading', '$t:admin.env.blurb', { visible: true })

/**
 * The one loud line on this page: every required variable this instance
 * resolved no value for, named above the list, so an operator who opens the
 * page mid-incident reads the answer before the inventory.
 *
 * Gated on the PAGE record's `requiredUnset` — the envelope itself, see the
 * page's `dataSource` — because whether ANY variable is missing is a fact no
 * row can answer, and an alert that is always there says nothing. Its lines
 * are the `variables` rows, each drawn only when it is required and unset.
 */
const requiredUnsetAlert = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        'border-destructive/40 bg-destructive/5 text-destructive flex flex-col gap-1 rounded-lg border px-4 py-3 text-sm [&_li]:list-none',
      role: 'alert',
      'data-testid': 'config-env-required-unset',
    },
    visibility: { record: { field: 'requiredUnset', isNotEmpty: true } },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'contents' },
        dataSource: { system: { endpoint: ENV_ENDPOINT, rowsKey: 'variables', idKey: 'key' } },
        children: [
          {
            type: 'container',
            element: 'div',
            props: { className: 'contents' },
            visibility: { record: { field: 'required', eq: true } },
            children: [
              // Two spans: a `$t:` lookup resolves only as a whole string, so
              // the key and the sentence about it are separate nodes.
              {
                type: 'container',
                element: 'div',
                props: { className: '' },
                visibility: { record: { field: 'isSet', eq: false } },
                children: [
                  text('span', 'font-mono font-medium', '$record.key'),
                  ' ',
                  text('span', '', '$t:admin.env.requiredUnset'),
                ],
              } as PageComponent,
            ],
          } as PageComponent,
        ],
      } as PageComponent,
    ],
  }) as PageComponent

/** The channel the toolbar publishes on and the grid reads. */
const ENV_CHANNEL = 'env-filter'

/**
 * One facet of the control row: a select publishing `<field> eq <choice>` on
 * the grid's channel. The endpoint applies no filter, and the grid holds every
 * declared variable, so the grid narrows its rows in memory, as it does for the
 * search term. Its empty choice withdraws the condition.
 */
const facet = (
  id: string,
  label: string,
  field: string,
  all: string,
  choices: readonly (readonly [value: string, label: string])[]
): PageComponent =>
  ({
    type: 'select',
    // No width of its own: shadcn's select trigger is `w-fit`, so a fixed box
    // around it left a hole after the shorter label. The facet is as wide as
    // what it says, and the row's `gap-2` is the only space between controls.
    props: { id, 'aria-label': label, className: 'h-8' },
    emptyOption: { label: all },
    // Starts ON the empty choice, so the closed control reads its label ("All
    // statuses") rather than the generic "Select…" of a control holding nothing.
    defaultValue: '',
    options: choices.map(([value, optionLabel]) => ({ value, label: optionLabel })),
    publishes: { bindTo: ENV_CHANNEL, field, operator: 'eq' },
  }) as PageComponent

/**
 * The control row: the search box, then the Status facet (set or not) and the
 * Required facet (required or optional). All three narrow together.
 */
const toolbar = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-wrap items-center gap-2' },
    children: [
      toolbarSearch(ENV_CHANNEL, '$t:admin.env.search'),
      facet(
        'env-status-filter',
        '$t:admin.env.filter.status',
        'isSet',
        '$t:admin.env.filter.allStatuses',
        [
          ['true', '$t:admin.env.set'],
          ['false', '$t:admin.env.notSet'],
        ]
      ),
      facet(
        'env-required-filter',
        '$t:admin.env.filter.required',
        'required',
        '$t:admin.env.filter.allRequirements',
        [
          ['true', '$t:admin.env.required'],
          ['false', '$t:admin.env.optional'],
        ]
      ),
    ],
  }) as PageComponent

/**
 * The declared variables as a table: the key, where the configuration uses
 * it, whether it is required, whether this instance resolved a value, and
 * from which rung. Never the value.
 *
 * The endpoint takes no search or filter parameters, and a declaration list is
 * bounded by the config rather than by data, so the grid holds every row and
 * narrows them in memory — as the decisions register does. No pager, for the
 * same reason.
 *
 * Status stays quiet: an unset optional variable is unset on purpose, and the
 * one loud case — required and unset — is named by the alert above the table.
 */
const variablesTable = (): PageComponent =>
  dataTable({
    props: { id: 'config-env-list', 'aria-label': '$t:admin.env.declared.region' },
    dataSource: {
      system: {
        endpoint: ENV_ENDPOINT,
        rowsKey: 'variables',
        idKey: 'key',
        bindTo: ENV_CHANNEL,
        // `q` rides as a param; the two facets' conditions reach the grid
        // whatever params are named, and are applied in memory.
        sharedFilter: { params: ['q'] },
      },
    },
    columns: [
      {
        field: 'key',
        label: '$t:admin.env.col.variable',
        cellStyle: [{ when: { isNotEmpty: true }, className: 'font-mono' }],
      },
      { field: 'usedBy', label: '$t:admin.env.usedBy', sortable: false },
      {
        field: 'required',
        label: '$t:admin.env.col.required',
        valueLabels: { true: '$t:admin.env.required', false: '$t:admin.env.optional' },
      },
      {
        field: 'isSet',
        label: '$t:admin.env.col.status',
        valueLabels: { true: '$t:admin.env.set', false: '$t:admin.env.notSet' },
        cellStyle: [
          { when: { eq: true }, className: STATUS_BADGE.quiet.positive },
          { when: { eq: false }, className: STATUS_BADGE.quiet.neutral },
        ],
      },
      {
        field: 'source',
        label: '$t:admin.env.col.source',
        valueLabels: {
          environment: '$t:admin.env.fromEnvironment',
          default: '$t:admin.env.fromDefault',
          unset: '—',
        },
      },
    ],
    emptyMessage: '$t:admin.env.empty',
    noMatchMessage: '$t:admin.env.noMatch',
  }) as PageComponent

/** Where values are set, said once under the table: the console only reads. */
const provenance = (): PageComponent =>
  ({
    type: 'text',
    element: 'p',
    props: { className: 'text-muted-foreground text-sm', 'data-testid': 'config-env-provenance' },
    content: '$t:admin.locked.audit.env.secrecyNotice',
  }) as PageComponent

export default consolePage({
  id: 'dashboard-config-env',
  path: '/env',
  title: '$t:admin.meta.env',
  shell: { breadcrumb: { env: '$t:admin.crumb.env' } },
  // The PAGE record is the env envelope, for the one gate no row can answer:
  // whether any required variable is unset (`requiredUnset`). With no
  // `recordKey` the record is the whole body; the rows bindings below are
  // unaffected, their templates being substituted from their own rows.
  page: { dataSource: { system: { endpoint: ENV_ENDPOINT, idKey: 'generatedAt' } } },
  body: [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex min-w-0 flex-col gap-4' },
      children: [header(), requiredUnsetAlert(), toolbar(), variablesTable(), provenance()],
    },
  ],
}) satisfies PageConfig
