/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Data-tab **Submissions** page ([internal ref], re-targeted from
 * the per-form Data tab to the global Data tab).
 *
 * DOGFOODING: the selected form's submissions inbox is now built from
 * GENERIC Sovrium components instead of the bespoke `admin-form-submissions` /
 * `admin-form-metrics` islands — the dashboard dogfoods its own component
 * library over the SAME admin forms-submissions API:
 *  - the submissions LIST is a config `data-table` bound via `dataSource.system`
 *    to `GET /api/admin/forms/:formName/submissions` (the `{ items }` envelope,
 *    rows keyed on `id`); the status enum is localized at render time via the
 *    column `valueLabels` map (+ a neutral status pill via `cellStyle`);
 *  - the CSV export is a config `button` with a `fetch` action in
 *    `mode: 'download'` (a credentialed save of
 *    `…/submissions/export?format=csv` — the endpoint already returns
 *    `text/csv`), alongside the "Open form" public-form `link`;
 *  - the submission METRICS are a generic `kpi` tile bound via `dataSource.system`
 *    (valuePath `totalCount` over `…/analytics`) next to the calm "Taux de
 *    conversion → metric unavailable" gap card (Sovrium has no view counter to
 *    divide by, so the conversion rate is a flagged gap, not an error);
 *  - clicking a submission row opens a READ-ONLY `record-drawer` bound via
 *    `dataSource.system` to the per-submission detail endpoint
 *    (`…/submissions/:id`) — the generic list → detail drill-down (CAP-2).
 *
 * The form name is a path segment resolved server-side, so each per-form page is
 * rebuilt with the form interpolated into the system endpoints (a static
 * endpoint per render). A bare `/_admin/forms` (app with ≥1 form) 302-REDIRECTS
 * to the FIRST declared form's inbox; an app with no forms shows an honest
 * whole-page empty state (no redirect). No new backend, no bespoke island.
 */

import {
  dataObjectFullWidth,
  dataPageEmptyState,
  dataPageIntro,
  firstObjectRedirect,
  objectScopedPage,
  type DataObjectRedirect,
} from './data-object-rail'
import type { DataShellOptions } from './data-landing-surface'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/** An operator form (the redirect's first-object source). */
type OperatorForm = App['forms'] extends ReadonlyArray<infer T> | undefined ? T : never

/** The declared form names, in declaration order (the first is the redirect target). */
function formNames(forms: ReadonlyArray<OperatorForm>): ReadonlyArray<string> {
  return forms.flatMap((form): ReadonlyArray<string> => {
    const { name } = form as { readonly name?: unknown }
    return typeof name === 'string' ? [name] : []
  })
}

/**
 * The PUBLIC URL where a form is reachable: its custom `path` when declared,
 * otherwise the always-available canonical `/forms/{name}` route (see
 * `FormPathSchema`). Used to render the "Open form" button so an
 * operator can jump to the live, submittable form.
 */
function publicFormHref(form: OperatorForm, name: string): string {
  const { path } = form as { readonly path?: unknown }
  return typeof path === 'string' && path.length > 0 ? path : `/forms/${name}`
}

/**
 * Resolve the selected form's public URL, or `undefined` when no form is
 * selected (or the slug matches none). Extracted so {@link buildDataFormsPage}
 * stays under the cyclomatic-complexity cap.
 */
function selectedFormHref(
  forms: ReadonlyArray<OperatorForm>,
  selected: string | undefined
): string | undefined {
  if (selected === undefined) return undefined
  const form = forms.find((f) => (f as { name?: string }).name === selected)
  return form ? publicFormHref(form, selected) : undefined
}

/** The page intro: heading + orienting one-liner. */
function intro(): Component {
  return dataPageIntro(
    'Submissions',
    'Review the submissions you have received, form by form. Choose a form to browse its inbox, open a submission, or export everything to CSV.'
  )
}

/** The whole-page empty state when the operator declares no forms. */
function noFormsBody(): Component {
  return dataPageEmptyState(
    'No forms',
    'This app declares no forms yet. Add one in your app config to start receiving submissions.',
    'No forms yet — the inbox follows.'
  )
}

// ---------------------------------------------------------------------------
// Generic-component building blocks (dogfood conversion)
// ---------------------------------------------------------------------------

/** Drawer id the submissions grid opens on a row click (the detail drill-down). */
const DETAIL_DRAWER_ID = 'form-submission-detail'

/** Outline toolbar-button chrome shared by the export button + public-form link. */
const TOOLBAR_BTN =
  'border-border text-foreground-subtle hover:text-foreground inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm'

/** Neutral status pill (mirrors the retired island's submission status pill). */
const STATUS_PILL = 'bg-background-subtle text-foreground-subtle rounded-full px-2 py-0.5 text-xs'

/**
 * Submission lifecycle status → French display label. The submissions endpoint
 * returns the RAW lifecycle status (`received` / `processing` / …), so the
 * localization is a render-only `valueLabels` map on the column (the API
 * contract is unchanged); unmapped statuses render verbatim.
 */
const STATUS_LABELS = {
  received: 'received',
  processing: 'in progress',
  processed: 'processed',
  done: 'processed',
  failed: 'failed',
  spam: 'spam',
} as const

/** The admin submissions LIST endpoint for a form (rows envelope: `{ items }`). */
function submissionsEndpoint(formName: string): string {
  return `/api/admin/forms/${encodeURIComponent(formName)}/submissions`
}

/** The submissions grid columns: status pill (relabeled) + received timestamp. */
function submissionsColumns(): ReadonlyArray<unknown> {
  return [
    {
      field: 'status',
      label: 'Status',
      valueLabels: STATUS_LABELS,
      cellStyle: Object.keys(STATUS_LABELS).map((value) => ({
        when: { eq: value },
        className: STATUS_PILL,
      })),
    },
    { field: 'submittedAt', label: 'Received', format: 'datetime' },
  ]
}

/**
 * The system-source `data-table` for the submissions list. Bound to
 * `GET /api/admin/forms/:formName/submissions` (the `{ items }` envelope, rows
 * keyed on `id`). A row click opens the system-detail `record-drawer`.
 */
function submissionsGrid(formName: string): Component {
  return {
    type: 'data-table',
    props: { 'aria-label': 'Submissions' },
    dataSource: {
      system: { endpoint: submissionsEndpoint(formName), rowsKey: 'items', idKey: 'id' },
    },
    columns: submissionsColumns(),
    pagination: { pageSize: 25 },
    emptyMessage: 'No submissions yet',
    // Row click opens the read-only system-detail drawer for the clicked row id.
    onRowClick: { action: 'openDrawer', component: DETAIL_DRAWER_ID },
  } as unknown as Component
}

/**
 * The READ-ONLY per-submission detail drawer. Bound via `dataSource.system` to
 * the detail endpoint (`…/submissions/:id`), the clicked row's id injected into
 * the `:id` slot. A system-detail drawer has no records table to PATCH, so it is
 * `canEdit: false` — the drill-down is view-only.
 */
function submissionsDetailDrawer(formName: string): Component {
  return {
    type: 'record-drawer',
    id: DETAIL_DRAWER_ID,
    dataSource: { system: { endpoint: `${submissionsEndpoint(formName)}/:id` } },
    canEdit: false,
    // recordFields describe the endpoint envelope (NOT a declared table).
    recordFields: [
      { name: 'status', type: 'single-line-text' },
      { name: 'submittedAt', type: 'single-line-text' },
    ],
  } as unknown as Component
}

/** The CSV-export button — a `fetch` action in `mode: 'download'` (saves the CSV). */
function exportButton(formName: string): Component {
  return {
    type: 'button',
    label: 'Export to CSV',
    props: { 'aria-label': 'Export to CSV', className: TOOLBAR_BTN },
    action: {
      type: 'fetch',
      mode: 'download',
      url: `${submissionsEndpoint(formName)}/export?format=csv`,
      filename: `${formName}-submissions.csv`,
    },
  } as unknown as Component
}

/** The "Open form" public-form link (opens the live form in a new tab). */
function openFormLink(formHref: string): Component {
  return {
    type: 'link',
    content: 'Open form',
    props: {
      href: formHref,
      target: '_blank',
      rel: 'noopener noreferrer',
      'aria-label': 'Open form',
      className: TOOLBAR_BTN,
    },
  } as unknown as Component
}

/** The submissions toolbar: open-the-public-form link + the CSV export trigger. */
function submissionsHeader(formName: string, formHref: string): Component {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'flex items-center justify-end gap-2' },
    children: [openFormLink(formHref), exportButton(formName)],
  } as unknown as Component
}

/** The submission KPI — a system-source `kpi` reading `totalCount` from analytics. */
function submissionsKpi(formName: string): Component {
  return {
    type: 'kpi',
    label: 'Submissions',
    dataSource: {
      system: {
        endpoint: `/api/admin/forms/${encodeURIComponent(formName)}/analytics`,
        valuePath: 'totalCount',
      },
    },
    kpiFormat: { type: 'number' },
  } as unknown as Component
}

/**
 * The "Conversion rate" gap card — Sovrium has no view/impression counter to
 * divide submissions by, so this slot shows a calm "metric unavailable"
 * placeholder rather than a numeric value (a flagged gap, not an error).
 */
function conversionGapCard(): Component {
  return {
    type: 'container',
    element: 'div',
    props: {
      className: 'border-border bg-background-raised flex flex-col gap-1 rounded-lg border p-4',
    },
    children: [
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-subtle text-xs font-medium tracking-wide uppercase' },
        content: 'Conversion rate',
      },
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-muted text-sm' },
        content: 'metric unavailable',
      },
    ],
  } as unknown as Component
}

/**
 * The selected form's metrics region: the `Submissions` KPI next to the calm
 * conversion-rate gap card, with the orienting footer note.
 */
function metricsSection(formName: string): Component {
  return {
    type: 'container',
    element: 'section',
    props: { 'aria-label': 'Form metrics', className: 'flex flex-col gap-4' },
    children: [
      {
        type: 'container',
        props: { className: 'grid grid-cols-1 gap-4 sm:grid-cols-2' },
        children: [submissionsKpi(formName), conversionGapCard()],
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle text-sm italic' },
        content: 'Conversion rate needs a view counter — Sovrium does not measure that yet.',
      },
    ],
  } as unknown as Component
}

/**
 * The selected form's body: the analytics metrics region ABOVE the submissions
 * toolbar + inbox, with the read-only detail drawer mounted alongside (opened on
 * a row click). Built entirely from generic components — no bespoke island.
 */
function selectedFormPanes(formName: string, formHref: string): Component {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-6' },
    children: [
      metricsSection(formName),
      submissionsHeader(formName, formHref),
      submissionsGrid(formName),
      submissionsDetailDrawer(formName),
    ],
  } as unknown as Component
}

/**
 * The page body for the selected form: its analytics region above its
 * submissions inbox, mounted FULL-WIDTH. Falls back to the whole-page empty
 * state when the slug matches no declared form (defensive — the redirect
 * normally lands on a real form).
 */
function formsBody(selected: string, selectedHref: string | undefined): Component {
  if (selectedHref === undefined) return noFormsBody()
  return dataObjectFullWidth(selectedFormPanes(selected, selectedHref))
}

/** Assemble the Submissions `Page` (id / path / meta / shell) around a body. */
function formsPage(selected: string | undefined, body: Component, options: DataShellOptions): Page {
  return objectScopedPage(
    { key: 'forms', label: 'Submissions', intro: intro() },
    selected,
    body,
    options
  )
}

/**
 * Build the Submissions page — or a 302 redirect to the first form.
 *
 * A bare `/_admin/forms` with ≥1 declared form returns a {@link DataObjectRedirect}
 * to the first form's inbox. With a `selected` form the body stacks the analytics
 * metrics region above the submissions inbox FULL-WIDTH (no rail). An app with no
 * forms shows the whole-page empty state (no redirect).
 */
export function buildDataFormsPage(
  operatorApp: App,
  selected: string | undefined,
  options: DataShellOptions
): Page | DataObjectRedirect {
  const forms = (operatorApp.forms ?? []) as ReadonlyArray<OperatorForm>
  const names = formNames(forms)

  // Bare object-page path with ≥1 form → 302-redirect to the first form's inbox.
  if (selected === undefined && names[0] !== undefined) {
    return firstObjectRedirect('forms', names[0])
  }

  const selectedHref = selectedFormHref(forms, selected)
  const body = selected ? formsBody(selected, selectedHref) : noFormsBody()

  return formsPage(selected, body, options)
}
