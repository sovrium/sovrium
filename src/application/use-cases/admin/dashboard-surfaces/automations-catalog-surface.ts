/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The automations catalog — the operator's view of every declared automation,
 * its effective state, and the pause / resume control
 *.
 *
 * Before this surface the console had NO automation catalog at all:
 * `/_admin/automations` was a run-history page, and automations appeared only as
 * options in its filter combobox. There was nowhere to show that an automation
 * is off, let alone turn it off.
 *
 * It is a config `data-table` over `dataSource.system`, exactly like the run
 * history below it — no bespoke island (`island-registry.ts` records 10 admin
 * islands already retired in favour of generic components).
 *
 * ## The two off-states, shown honestly
 *
 * An automation is off for one of two unrelated reasons, and conflating them
 * produces a control that cannot work:
 *
 *  - **`disabled`** — `enabled: false` in the app config. Configuration is
 * code-only ([internal ref] D2); the console must never offer to change it. So this
 *    row gets NO control, and its State cell names the config as the source.
 *  - **`paused`** — an operational pause held in `system.automation_pauses`,
 *    which the operator set and can clear. This row gets Resume.
 *
 * Both are expressed with `visibleWhen` on the action items rather than with a
 * disabled button or a special case: a `disabled` row satisfies neither
 * predicate, so nothing renders. A resume button that cannot work would be the
 * same class of lie as a search box that returns wrong answers.
 *
 * ## Why the State column has no colour
 *
 * [internal ref] **A7** names this exact surface: the Admin Space's own status pills
 * are *chrome*, because Sovrium invented that vocabulary rather than the app
 * author, and A1 retired `success` / `warning` — they "do not return through a
 * chip-shaped door". State is therefore plain text relabelled by `valueLabels`.
 *
 * Note the run-history table directly BELOW this one still paints two semantic
 * pills (`automation-runs-surface.ts:81,89`). Those are pending A1/A7 alignment
 * ([internal ref] D8 sequences the code flip separately) — they are not a pattern to
 * extend upward for visual consistency.
 */

import type { Component } from '@/domain/models/app/pages/components'

/**
 * Id of the catalog grid. Doubles as the `onSuccess.refetch` target so a
 * pause / resume re-queries this same table and the State cell reconciles
 * without a page reload.
 */
const CATALOG_GRID_ID = 'automations-catalog-grid'

/**
 * Catalog columns.
 *
 * `valueLabels` is render-time only — the endpoint contract keeps the raw
 * `'active' | 'paused' | 'disabled'` enum (the response schema is `.strict()`,
 * so relabelling server-side is impossible by design).
 *
 * `Paused by` / `Paused at` are blank on every non-paused row. Two columns
 * rather than one concatenated string: during an incident an operator needs
 * both *who* stopped it and *when*, and separate columns sort and format
 * properly. `pausedBy` is nullable — the pause outlives the account that set it
 * (`ON DELETE SET NULL`), so a deleted operator leaves the pause standing with
 * an empty actor.
 */
const CATALOG_COLUMNS = [
  { field: 'name', label: 'Automation' },
  { field: 'trigger', label: 'Trigger' },
  {
    field: 'state',
    label: 'State',
    valueLabels: {
      active: 'Active',
      paused: 'Paused',
      disabled: 'Disabled in config',
    },
  },
  { field: 'pausedBy', label: 'Paused by' },
  { field: 'pausedAt', label: 'Paused at', format: 'datetime' },
  {
    type: 'actions',
    label: '',
    actions: [
      {
        label: 'Pause',
        visibleWhen: { field: 'state', eq: 'active' },
        /*
         * Both labels are set EXPLICITLY. The confirm-gate runtime falls back to
         * FRENCH ('Confirmer' / 'Annuler' — `islands/shared/confirm-gate-runtime.ts`),
         * which is a live defect in the English operator console and is reported
         * separately. Do not drop these to "use the default": the default is wrong.
         *
         * The message's second sentence is a factual claim, verified before it
         * shipped: every gate is consulted at dispatch/resolve time, nothing
         * re-checks inside the run loop, and there is no delayed-resume path
         * (`automation_delayed_steps` has no reader). If a mid-run re-check is
         * ever added, this sentence becomes false and must change with it.
         */
        confirm: {
          title: 'Pause this automation?',
          message: 'New runs stop until you resume. A run already in progress is not cancelled.',
          confirmLabel: 'Pause',
          cancelLabel: 'Cancel',
        },
        action: {
          type: 'fetch',
          method: 'POST',
          // `$record.name` resolves through the generic `$record.<field>` matcher
          // (`substitute-record-vars.ts`). Automation names are constrained to
          // /^[a-z][a-z0-9-]*$/ by AppSchema, so they are URL-safe unencoded —
          // the same property the webhook routes already rely on.
          url: '/api/admin/automations/$record.name/pause',
          onSuccess: { refetch: CATALOG_GRID_ID },
        },
      },
      {
        // No confirm gate: resume is the reversal of a reversible action, so a
        // gate here is friction without consequence. Confirmation is reserved
        // for the direction that stops production work.
        label: 'Resume',
        visibleWhen: { field: 'state', eq: 'paused' },
        action: {
          type: 'fetch',
          method: 'POST',
          url: '/api/admin/automations/$record.name/resume',
          onSuccess: { refetch: CATALOG_GRID_ID },
        },
      },
      // A `state: 'disabled'` row satisfies NEITHER predicate, so no control
      // renders on it. That is the whole of the "no resume button that cannot
      // work" requirement — declarative, not a special case.
    ],
  },
] as const

/** The catalog `data-table`, bound to the automations catalog endpoint. */
function catalogDataTable(): Component {
  return {
    type: 'data-table',
    props: {
      id: CATALOG_GRID_ID,
      'aria-label': 'Automations',
    },
    dataSource: {
      system: {
        endpoint: '/api/admin/automations',
        rowsKey: 'items',
        // Identity is the config `name`, not a generated id: the catalog is a
        // view of config, and `automation_definitions` rows do not exist until
        // an automation's first run.
        idKey: 'name',
      },
    },
    columns: CATALOG_COLUMNS,
    toolbar: { sort: true },
    emptyMessage: 'No automations',
  } as unknown as Component
}

/**
 * The catalog section: the grid alone, with NO heading of its own.
 *
 * The catalog carries no `h3` deliberately. It sits directly under the page
 * heading, which already reads "Automations" — a section heading here restated
 * it verbatim, which is exactly the ornament [internal ref] D4 tells us to cut. The
 * run history below DOES take an `h3`, because it is the section that needs
 * naming to be distinguishable from the catalog above it.
 *
 * The orienting sentences live in the page intro (`data-automations-surface`)
 * rather than here, so the page states its one idea once.
 */
export function automationsCatalogBody(): Component {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'px-6' },
    children: [catalogDataTable()],
  } as unknown as Component
}

export { CATALOG_GRID_ID }
