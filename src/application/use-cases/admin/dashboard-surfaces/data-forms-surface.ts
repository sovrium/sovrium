/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

type OperatorForm = App['forms'] extends ReadonlyArray<infer T> | undefined ? T : never

function formNames(forms: ReadonlyArray<OperatorForm>): ReadonlyArray<string> {
  return forms.flatMap((form): ReadonlyArray<string> => {
    const { name } = form as { readonly name?: unknown }
    return typeof name === 'string' ? [name] : []
  })
}

function publicFormHref(form: OperatorForm, name: string): string {
  const { path } = form as { readonly path?: unknown }
  return typeof path === 'string' && path.length > 0 ? path : `/forms/${name}`
}

function selectedFormHref(
  forms: ReadonlyArray<OperatorForm>,
  selected: string | undefined
): string | undefined {
  if (selected === undefined) return undefined
  const form = forms.find((f) => (f as { name?: string }).name === selected)
  return form ? publicFormHref(form, selected) : undefined
}

function intro(): Component {
  return dataPageIntro(
    'Soumissions',
    'Consultez les soumissions reçues, formulaire par formulaire. Choisissez un formulaire pour parcourir sa boîte de réception, ouvrir une soumission, ou exporter le tout en CSV.'
  )
}

function noFormsBody(): Component {
  return dataPageEmptyState(
    'Aucun formulaire',
    'Cette application ne déclare encore aucun formulaire. Ajoutez-en un depuis l’onglet Config pour commencer à recevoir des soumissions.',
    'Pas encore de formulaire — la boîte de réception viendra ensuite.'
  )
}


const DETAIL_DRAWER_ID = 'form-submission-detail'

const TOOLBAR_BTN =
  'border-border text-foreground-subtle hover:text-foreground inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm'

const STATUS_PILL = 'bg-background-subtle text-foreground-subtle rounded-full px-2 py-0.5 text-xs'

const STATUS_LABELS = {
  received: 'reçue',
  processing: 'en cours',
  processed: 'traitée',
  done: 'traitée',
  failed: 'échec',
  spam: 'spam',
} as const

function submissionsEndpoint(formName: string): string {
  return `/api/admin/forms/${encodeURIComponent(formName)}/submissions`
}

function submissionsColumns(): ReadonlyArray<unknown> {
  return [
    {
      field: 'status',
      label: 'État',
      valueLabels: STATUS_LABELS,
      cellStyle: Object.keys(STATUS_LABELS).map((value) => ({
        when: { eq: value },
        className: STATUS_PILL,
      })),
    },
    { field: 'submittedAt', label: 'Reçue le', format: 'datetime' },
  ]
}

function submissionsGrid(formName: string): Component {
  return {
    type: 'data-table',
    props: { 'aria-label': 'Soumissions' },
    dataSource: {
      system: { endpoint: submissionsEndpoint(formName), rowsKey: 'items', idKey: 'id' },
    },
    columns: submissionsColumns(),
    pagination: { pageSize: 25 },
    emptyMessage: 'Aucune soumission pour le moment',
    onRowClick: { action: 'openDrawer', component: DETAIL_DRAWER_ID },
  } as unknown as Component
}

function submissionsDetailDrawer(formName: string): Component {
  return {
    type: 'record-drawer',
    id: DETAIL_DRAWER_ID,
    dataSource: { system: { endpoint: `${submissionsEndpoint(formName)}/:id` } },
    canEdit: false,
    recordFields: [
      { name: 'status', type: 'single-line-text' },
      { name: 'submittedAt', type: 'single-line-text' },
    ],
  } as unknown as Component
}

function exportButton(formName: string): Component {
  return {
    type: 'button',
    label: 'Exporter en CSV',
    props: { 'aria-label': 'Exporter en CSV', className: TOOLBAR_BTN },
    action: {
      type: 'fetch',
      mode: 'download',
      url: `${submissionsEndpoint(formName)}/export?format=csv`,
      filename: `${formName}-submissions.csv`,
    },
  } as unknown as Component
}

function openFormLink(formHref: string): Component {
  return {
    type: 'link',
    content: 'Ouvrir le formulaire',
    props: {
      href: formHref,
      target: '_blank',
      rel: 'noopener noreferrer',
      'aria-label': 'Ouvrir le formulaire',
      className: TOOLBAR_BTN,
    },
  } as unknown as Component
}

function submissionsHeader(formName: string, formHref: string): Component {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'flex items-center justify-end gap-2' },
    children: [openFormLink(formHref), exportButton(formName)],
  } as unknown as Component
}

function submissionsKpi(formName: string): Component {
  return {
    type: 'kpi',
    label: 'Soumissions',
    dataSource: {
      system: {
        endpoint: `/api/admin/forms/${encodeURIComponent(formName)}/analytics`,
        valuePath: 'totalCount',
      },
    },
    kpiFormat: { type: 'number' },
  } as unknown as Component
}

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
        content: 'Taux de conversion',
      },
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-muted text-sm' },
        content: 'métrique indisponible',
      },
    ],
  } as unknown as Component
}

function metricsSection(formName: string): Component {
  return {
    type: 'container',
    element: 'section',
    props: { 'aria-label': 'Métriques du formulaire', className: 'flex flex-col gap-4' },
    children: [
      {
        type: 'container',
        props: { className: 'grid grid-cols-1 gap-4 sm:grid-cols-2' },
        children: [submissionsKpi(formName), conversionGapCard()],
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle font-serif text-sm italic' },
        content:
          'Le taux de conversion attend un compteur de vues — Sovrium ne le mesure pas encore.',
      },
    ],
  } as unknown as Component
}

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

function formsBody(selected: string, selectedHref: string | undefined): Component {
  if (selectedHref === undefined) return noFormsBody()
  return dataObjectFullWidth(selectedFormPanes(selected, selectedHref))
}

function formsPage(selected: string | undefined, body: Component, options: DataShellOptions): Page {
  return objectScopedPage(
    { key: 'forms', label: 'Soumissions', intro: intro() },
    selected,
    body,
    options
  )
}

export function buildDataFormsPage(
  operatorApp: App,
  selected: string | undefined,
  options: DataShellOptions
): Page | DataObjectRedirect {
  const forms = (operatorApp.forms ?? []) as ReadonlyArray<OperatorForm>
  const names = formNames(forms)

  if (selected === undefined && names[0] !== undefined) {
    return firstObjectRedirect('forms', names[0])
  }

  const selectedHref = selectedFormHref(forms, selected)
  const body = selected ? formsBody(selected, selectedHref) : noFormsBody()

  return formsPage(selected, body, options)
}
