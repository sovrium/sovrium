/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Data-tab **Runs** page ([internal ref], re-
 * targeted from the per-automation Data tab to the global Data tab).
 *
 * `/_admin/data/automations` opens the Runs run-history workspace (see
 * {@link ./automation-runs-surface}). The run-history LIST is a config
 * `data-table` bound via `dataSource.system` to `GET /api/admin/automations/runs`
 * (the dashboard dogfoods its own components instead of a bespoke run-list
 * island); two external comboboxes forward `?automationName=` / `?status=`, and
 * the run-detail island opens each run's per-step Input/Output I/O, error
 * callout, and log panel over `GET /api/admin/automations/runs/:id`. No new
 * backend.
 *
 * The view defaults to ALL runs across every automation, narrowed by the
 * automation filter rather than a left-rail picker (so the `object` route
 * segment is ignored). An app with no automations shows an honest whole-page
 * empty state.
 *
 * Pass-2 enhancements (flagged to [internal ref], NOT built here):
 *  - a cross-automation GLOBAL runs feed (the runs API already supports a
 *    no-`automationName` query, but the run-history island fetches per-
 *    automation only — a global-feed island mode is a behaviour change);
 *  - a date-range filter (the API supports `?from`/`?to`, the island does not);
 *  - run REPLAY (a write the read-only runs API does not cover — needs a new
 *    POST endpoint; the run history is read + sandbox-test only today).
 */

import { automationRunsBody } from './automation-runs-surface'
import { automationsCatalogBody } from './automations-catalog-surface'
import { homeCrumb, wrapInShell } from './dashboard-shell-surface'
import { dataPageEmptyState, dataPageIntro } from './data-object-rail'
import type { DataShellOptions } from './data-landing-surface'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/** An operator automation (the run-filter option source). */
type OperatorAutomation = App['automations'] extends ReadonlyArray<infer T> | undefined ? T : never

/** The operator's automation names — the options for the island's automation filter. */
function automationNames(automations: ReadonlyArray<OperatorAutomation>): ReadonlyArray<string> {
  return automations.flatMap((automation): ReadonlyArray<string> => {
    const { name } = automation as { readonly name?: unknown }
    return typeof name === 'string' ? [name] : []
  })
}

/** The page intro: heading + orienting one-liner. */
function intro(): Component {
  /*
   * The intro carries the two sentences the operator actually needs, and drops
   * the "here is what this page contains" line the old copy opened with — the
   * catalog and the run history are both visible, so narrating them was
   * ornament ([internal ref] D4).
   *
   * What survives is guidance: sentence one says what Pause does and what it
   * deliberately does NOT touch (your config); sentence two tells an operator
   * staring at a `Disabled in config` row where to go instead. D4 cuts
   * ornament, not the sentence that says what happens next.
   */
  return dataPageIntro(
    'Automations',
    'Pause an automation to stop it running without changing your config. ' +
      'An automation disabled in your app config can only be re-enabled there.'
  )
}

/**
 * The run-history section heading, which now sits BELOW the catalog.
 *
 * Before the catalog existed the whole page WAS the run history, so the page
 * heading read "Runs". With two sections the page is named for the entity and
 * each section names itself — which also makes the page title agree with the
 * route (`/_admin/automations`) and the nav key, both of which already said
 * "automations".
 */
function runHistoryHeading(): Component {
  return {
    type: 'text',
    element: 'h3',
    props: { className: 'px-6 text-lg font-semibold tracking-tight' },
    content: 'Run history',
  } as unknown as Component
}

/** The whole-page empty state when the operator declares no automations. */
function noAutomationsBody(): Component {
  return dataPageEmptyState(
    'No automations',
    'This app declares no automations yet. Add one in your app config to see its runs appear here.',
    'No automations yet — so nothing to run.'
  )
}

/**
 * Build the Runs page. The run history defaults to ALL
 * runs across every automation, with an automation filter (and a status filter)
 * in the runs island toolbar — there is no left-rail picker any more. An app with
 * no automations shows the whole-page empty state. The `object` route segment is
 * ignored (automation selection is now a filter, not a path).
 */
export function buildDataAutomationsPage(
  operatorApp: App,
  _object: string | undefined,
  options: DataShellOptions
): Page {
  const automations = (operatorApp.automations ?? []) as ReadonlyArray<OperatorAutomation>
  const names = automationNames(automations)
  // With no automations declared there is nothing to catalogue AND nothing to
  // run, so the whole-page empty state still stands in for both sections.
  const body =
    names.length === 0
      ? [noAutomationsBody()]
      : [automationsCatalogBody(), runHistoryHeading(), automationRunsBody(names)]

  return {
    id: 'dashboard-data-automations',
    name: 'dashboard-data-automations',
    path: '/automations',
    meta: { title: 'Sovrium — Data · Automations' },
    components: wrapInShell([intro(), ...body], {
      canEdit: options.canEdit,
      appName: options.appName,
      appVersion: options.appVersion,
      breadcrumb: [
        homeCrumb(options.appName),
        { label: 'Automations', href: '/_admin/automations' },
      ],
    }),
  } as Page
}
