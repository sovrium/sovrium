/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { homeCrumb, wrapInShell, type ShellBreadcrumbItem } from './dashboard-shell-surface'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

const EXPORT_BUTTON = "Générer l'export"
const EXPORT_STATUS = 'Export généré'
const ERASE_BUTTON = "Demander l'effacement"
const GRACE_CALLOUT =
  "L'effacement est définitif et irréversible. Après un délai de grâce de 7 jours, votre compte et vos données sont supprimés définitivement — ils ne sont pas récupérables depuis la corbeille."
const CONFIRM_TITLE = "Confirmer l'effacement"
const CONFIRM_BODY =
  "Cette action est définitif et irréversible. Saisissez votre adresse e-mail pour confirmer l'effacement de votre compte."
const CONFIRM_INPUT = 'Saisissez votre adresse e-mail'
const CONFIRM_LABEL = 'Effacer'
const ERASE_STATUS = 'Suppression planifiée'
const CANCEL_BUTTON = 'Annuler'
const CANCEL_CONFIRM_TITLE = "Confirmer l'annulation"

const PENDING_GRID_ID = 'gdpr-pending-grid'

const CARD_CLASS = 'border-border bg-background-raised flex flex-col gap-3 rounded-md border p-5'

function identityCard(): Component {
  return {
    type: 'container',
    element: 'section',
    props: { className: CARD_CLASS, 'aria-label': 'Mon identité' },
    children: [
      {
        type: 'text',
        element: 'h3',
        props: { className: 'text-foreground text-lg font-semibold' },
        content: 'Mon identité',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground text-sm', 'data-testid': 'gdpr-identity-email' },
        session: 'email',
      },
    ],
  } as unknown as Component
}

function exportCard(): Component {
  return {
    type: 'container',
    element: 'section',
    props: { className: CARD_CLASS, 'aria-label': 'Exporter mes données' },
    children: [
      {
        type: 'text',
        element: 'h3',
        props: { className: 'text-foreground text-lg font-semibold' },
        content: 'Exporter mes données',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle text-sm' },
        content:
          'Téléchargez une archive JSON de vos données (profil, enregistrements créés, soumissions de formulaires, activité).',
      },
      {
        type: 'button',
        content: EXPORT_BUTTON,
        props: { id: 'gdpr-export-btn', className: 'bg-primary text-primary-fg w-fit' },
        action: {
          type: 'fetch',
          mode: 'download',
          url: '/api/account/export',
          filename: 'mon-compte.json',
          onSuccess: {
            type: 'toast',
            variant: 'success',
            message: 'Export terminé',
            status: { target: 'gdpr-export-status', message: EXPORT_STATUS },
          },
        },
      },
      {
        type: 'text',
        element: 'p',
        props: { id: 'gdpr-export-status', className: 'text-success-fg text-sm' },
        content: '',
      },
    ],
  } as unknown as Component
}

const ERASE_CONFIRM = {
  title: CONFIRM_TITLE,
  message: CONFIRM_BODY,
  role: 'alertdialog',
  input: { label: CONFIRM_INPUT, matchValue: '$session.email' },
  confirmLabel: CONFIRM_LABEL,
  cancelLabel: 'Annuler',
} as const

function eraseCard(): Component {
  return {
    type: 'container',
    element: 'section',
    props: {
      className: 'border-error-border bg-error-subtle flex flex-col gap-3 rounded-md border p-5',
      'aria-label': 'Effacer mon compte',
    },
    children: [
      {
        type: 'text',
        element: 'h3',
        props: { className: 'text-error-fg text-lg font-semibold' },
        content: 'Effacer mon compte',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle text-sm' },
        content: GRACE_CALLOUT,
      },
      {
        type: 'button',
        content: ERASE_BUTTON,
        props: { id: 'gdpr-erase-btn', className: 'bg-error-solid text-error-solid-fg w-fit' },
        confirm: ERASE_CONFIRM,
        action: {
          type: 'fetch',
          url: '/api/account/delete',
          method: 'POST',
          body: { confirm: true },
          onSuccess: {
            type: 'toast',
            variant: 'success',
            message: ERASE_STATUS,
            status: { target: 'gdpr-erase-status', message: ERASE_STATUS },
          },
        },
      },
      {
        type: 'text',
        element: 'p',
        props: { id: 'gdpr-erase-status', className: 'text-error-fg text-sm' },
        content: '',
      },
    ],
  } as unknown as Component
}

const PENDING_COLUMNS = [
  { field: 'email', label: 'Compte' },
  { field: 'scheduledErasureAt', label: 'Échéance', format: 'relative-time' },
  {
    type: 'actions',
    label: 'Actions',
    actions: [
      {
        label: CANCEL_BUTTON,
        confirm: {
          title: CANCEL_CONFIRM_TITLE,
          message:
            "Annuler la demande d'effacement de votre compte ? Votre compte ne sera pas supprimé.",
          role: 'alertdialog',
          confirmLabel: CANCEL_CONFIRM_TITLE,
          cancelLabel: 'Retour',
        },
        action: {
          type: 'fetch',
          url: '/api/account/delete',
          method: 'POST',
          body: { cancel: true },
          onSuccess: { type: 'toast', message: 'Demande annulée', refetch: PENDING_GRID_ID },
        },
      },
    ],
  },
] as const

function pendingTable(): Component {
  return {
    type: 'data-table',
    props: { id: PENDING_GRID_ID, 'aria-label': 'Demandes en cours' },
    dataSource: {
      system: {
        endpoint: '/api/account/pending-erasure',
        rowsKey: 'items',
        idKey: 'id',
      },
    },
    columns: PENDING_COLUMNS,
    emptyMessage: "Aucune demande d'effacement en cours",
  } as unknown as Component
}

export interface GdprOptions {
  readonly canEdit: boolean
  readonly appName?: string
  readonly appVersion?: string
  readonly publishedSnapshot: Readonly<Record<string, unknown>>
}

export function buildGdprPage(title: string, options: GdprOptions): Page {
  const { canEdit, appName, appVersion, publishedSnapshot } = options
  const breadcrumb: ReadonlyArray<ShellBreadcrumbItem> = [
    homeCrumb(appName),
    { label: 'Mon compte' },
  ]
  const body: Component = {
    type: 'container',
    element: 'div',
    props: { className: 'flex max-w-3xl flex-col gap-6' },
    children: [
      identityCard(),
      {
        type: 'container',
        element: 'div',
        props: { className: 'grid gap-4 sm:grid-cols-2' },
        children: [exportCard(), eraseCard()],
      },
      pendingTable(),
    ],
  } as unknown as Component
  return {
    id: 'dashboard-gdpr',
    name: 'dashboard-gdpr',
    path: '/gdpr',
    meta: { title },
    components: wrapInShell([body], {
      canEdit,
      appName,
      appVersion,
      breadcrumb,
      publishedSnapshot,
    }),
  } as Page
}
