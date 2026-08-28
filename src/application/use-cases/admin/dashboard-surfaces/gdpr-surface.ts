/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Dashboard Data & GDPR self-service surface,
 * converted onto generic config (Consoles-as-Config, [internal ref] dogfooding).
 *
 * The signed-in admin's self-service GDPR console: export and erase the admin's
 * OWN account (hard-delete with a 7-day grace, S5) and cancel a pending erasure.
 * It reuses the EXISTING session-bound account backends end to end
 * (`GET /api/account/export`, `POST /api/account/delete`,
 * `GET /api/account/pending-erasure`) — no new backend.
 *
 * The bespoke `admin-gdpr` island (a hand-rolled IdentityCard + ExportCard +
 * EraseCard + EraseConfirmDialog + PendingTable) is GONE; every affordance is now
 * generic page vocabulary that ships for ANY Sovrium app:
 *
 *   - IDENTITY  → a session-bound `text` (`session: 'email'`) renders the
 *     signed-in operator's OWN email, resolved client-side from the session;
 *   - EXPORT    → a standalone `button` whose config `fetch` action is
 *     `mode: 'download'` to `GET /api/account/export` (native `my-account.json`)
 *     with a persistent `onSuccess.status` "Export generated";
 *   - ERASE     → a destructive `button` whose object `confirm` is a type-to-confirm
 *     gate (`role: 'alertdialog'`, `input.matchValue: '$session.email'`, "Effacer"
 *     stays disabled until the operator retypes their own email) over a config
 *     `fetch` POST `/api/account/delete { confirm: true }` with a persistent
 *     `onSuccess.status` "Deletion scheduled" (STATUS ONLY — scheduling an
 *     erasure revokes the session by design, so the pending table is NOT
 *     re-asserted in that flow);
 *   - PENDING   → a generic system-source `data-table` bound to
 *     `GET /api/account/pending-erasure` (`rowsKey: 'items'`), with a
 *     `relative-time` due column, an `emptyMessage`, and a per-row "Cancel"
 *     config `fetch` action POST `/api/account/delete { cancel: true }`
 *     (confirm-gated) that `onSuccess.refetch`es the table back to empty.
 *
 * Wrapped in the persistent 3-zone shell so the sidebar + breadcrumb persist.
 */

import { homeCrumb, wrapInShell, type ShellBreadcrumbItem } from './dashboard-shell-surface'
import { dataPageIntro } from './data-object-rail'
import { accountCrossLink } from './profile-surface'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

// ── Preserved French copy (byte-identical to the bespoke island so the
//    conversion is copy-neutral and the spec's exact role/name lookups match). ──
/** Export card button label. */
const EXPORT_BUTTON = 'Generate export'
/** Persistent export-success status (the `onSuccess.status` message → role="status" name). */
const EXPORT_STATUS = 'Export generated'
/** Erase card button label. */
const ERASE_BUTTON = 'Request erasure'
/** The 7-day-grace / irreversibility callout copy (S5) shown on the erase card. */
const GRACE_CALLOUT =
  'Erasure is permanent and irreversible. After a 7-day grace period, your account and your data are deleted for good — they cannot be restored from the trash.'
/** Erase type-to-confirm gate — the dialog's accessible name (its `title`). */
const CONFIRM_TITLE = 'Confirm erasure'
/** Erase confirm body — states the irreversibility (S5). Distinct from the title. */
const CONFIRM_BODY =
  'This action is permanent and irreversible. Enter your email address to confirm erasure of your account.'
/** Erase type-to-confirm input label (also the visible input label). */
const CONFIRM_INPUT = 'Enter your email address'
/** Erase confirm affordance label (distinct from the trigger label). */
const CONFIRM_LABEL = 'Erase'
/** Persistent erasure-scheduled status (STATUS ONLY — the session is revoked). */
const ERASE_STATUS = 'Deletion scheduled'
/** Pending-erasure per-row cancel trigger label. */
const CANCEL_BUTTON = 'Cancel'
/** Cancel confirm gate — accessible name + confirm affordance (distinct from the row trigger). */
const CANCEL_CONFIRM_TITLE = 'Confirm cancellation'

/** The pending-erasure `data-table` id — the `onSuccess.refetch` target. */
const PENDING_GRID_ID = 'gdpr-pending-grid'

/** Shared card chrome (border + raised background + rounded padding). */
const CARD_CLASS = 'border-border bg-background-raised flex flex-col gap-3 rounded-md border p-5'

/**
 * The identity card: a heading + a session-bound `text` rendering the signed-in
 * operator's OWN email (`session: 'email'`, resolved client-side from the caller's
 * session; anonymous callers render nothing). Replaces the bespoke "My identity"
 * card's hand-rolled session fetch.
 */
function identityCard(): Component {
  return {
    type: 'container',
    element: 'section',
    props: { className: CARD_CLASS, 'aria-label': 'My identity' },
    children: [
      {
        type: 'text',
        element: 'h2',
        props: { className: 'text-foreground text-lg font-semibold' },
        content: 'My identity',
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

/**
 * The export card: heading + archive copy + a `mode: download` config `fetch`
 * button (native `my-account.json` over `GET /api/account/export`) whose
 * `onSuccess.status` paints the persistent "Export generated" region. The reserved
 * status target (`#gdpr-export-status`) is promoted to `role="status"` on success.
 */
function exportCard(): Component {
  return {
    type: 'container',
    element: 'section',
    props: { className: CARD_CLASS, 'aria-label': 'Export my data' },
    children: [
      {
        type: 'text',
        element: 'h2',
        props: { className: 'text-foreground text-lg font-semibold' },
        content: 'Export my data',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle text-sm' },
        content:
          'Download a JSON archive of your data (profile, records you created, form submissions, activity).',
      },
      {
        type: 'button',
        content: EXPORT_BUTTON,
        props: { id: 'gdpr-export-btn', className: 'bg-primary text-primary-fg w-fit' },
        action: {
          type: 'fetch',
          mode: 'download',
          url: '/api/account/export',
          filename: 'my-account.json',
          onSuccess: {
            type: 'toast',
            variant: 'success',
            message: 'Export complete',
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

/**
 * The erase button's object `confirm` — a type-to-confirm `alertdialog` whose
 * "Effacer" affordance stays disabled until the operator retypes their OWN email
 * (`input.matchValue: '$session.email'`, resolved client-side from the session).
 * The body states the irreversibility (S5); the title is separate from it.
 */
const ERASE_CONFIRM = {
  title: CONFIRM_TITLE,
  message: CONFIRM_BODY,
  role: 'alertdialog',
  input: { label: CONFIRM_INPUT, matchValue: '$session.email' },
  confirmLabel: CONFIRM_LABEL,
  cancelLabel: 'Cancel',
} as const

/**
 * The erase card: a red-accented heading + the 7-day-grace / irreversibility
 * callout (S5) + a destructive config `fetch` button. The button's object
 * {@link ERASE_CONFIRM} type-to-confirm gate holds the erase until the operator
 * retypes their own email; on confirm it POSTs `/api/account/delete
 * { confirm: true }` (schedules the hard-delete after the 7-day grace) and paints
 * the persistent "Deletion scheduled" status. NO `onSuccess.refetch` — the
 * erase revokes the session, so a refetch would be an unauthenticated read (the
 * approved status-only simplification).
 */
function eraseCard(): Component {
  return {
    type: 'container',
    element: 'section',
    props: {
      className: 'border-error-border bg-error-subtle flex flex-col gap-3 rounded-md border p-5',
      'aria-label': 'Erase my account',
    },
    children: [
      {
        type: 'text',
        element: 'h2',
        props: { className: 'text-error-fg text-lg font-semibold' },
        content: 'Erase my account',
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

/**
 * The pending-erasure table's per-row action column: a single "Cancel" gesture
 * whose object `confirm` (a distinct `alertdialog` titled "Confirm cancellation"
 * so the confirm affordance does not collide with the "Cancel" row trigger) gates
 * a config `fetch` POST `/api/account/delete { cancel: true }`; `onSuccess.refetch`
 * re-queries the system source, clearing the row (cancel does NOT revoke the
 * session, so the live refetch-to-empty is valid).
 */
const PENDING_COLUMNS = [
  { field: 'email', label: 'Account' },
  { field: 'scheduledErasureAt', label: 'Due', format: 'relative-time' },
  {
    type: 'actions',
    label: 'Actions',
    actions: [
      {
        label: CANCEL_BUTTON,
        confirm: {
          title: CANCEL_CONFIRM_TITLE,
          message: 'Cancel your account erasure request? Your account will not be deleted.',
          role: 'alertdialog',
          confirmLabel: CANCEL_CONFIRM_TITLE,
          cancelLabel: 'Back',
        },
        action: {
          type: 'fetch',
          url: '/api/account/delete',
          method: 'POST',
          body: { cancel: true },
          onSuccess: { type: 'toast', message: 'Request cancelled', refetch: PENDING_GRID_ID },
        },
      },
    ],
  },
] as const

/**
 * The pending-erasure table as a generic system-source `data-table`, bound to
 * `GET /api/account/pending-erasure` (`{ items: [...] }`, keyed on `id`). Renders
 * the caller's own pending row (email + a `relative-time` due date) and an
 * `emptyMessage` when nothing is scheduled.
 */
function pendingTable(): Component {
  return {
    type: 'data-table',
    props: { id: PENDING_GRID_ID, 'aria-label': 'Requests in progress' },
    dataSource: {
      system: {
        endpoint: '/api/account/pending-erasure',
        rowsKey: 'items',
        idKey: 'id',
      },
    },
    columns: PENDING_COLUMNS,
    emptyMessage: 'No erasure request in progress',
  } as unknown as Component
}

/** Shell-wrap concerns for the standalone Data & GDPR surface. */
export interface GdprOptions {
  /** F6 tier / F5 editing flag; drives the read-only posture + sidebar affordances. */
  readonly canEdit: boolean
  /** Operator slug; seeds the shell sidebar brand label. */
  readonly appName?: string
  /** Operator config version (`app.version`); seeds the sidebar version chip. */
  readonly appVersion?: string
}

/**
 * Build the Data & GDPR page (`/_admin/gdpr`), wrapped in the persistent
 * 3-zone sidebar shell. The body is generic config — the bespoke `admin-gdpr`
 * island is GONE.
 *
 * @param title - the page meta title
 * @param options - tier + shell concerns
 */
export function buildGdprPage(title: string, options: GdprOptions): Page {
  const { canEdit, appName, appVersion } = options
  // [internal ref] split the operator's own account in two. This page is the DATA half —
  // what the instance holds about me and how I get it out or erase it. The
  // IDENTITY half (name / email / password) moved to `/_admin/profile`, which is
  // now what the profile menu's "My account" opens.
  const breadcrumb: ReadonlyArray<ShellBreadcrumbItem> = [homeCrumb(appName), { label: 'My data' }]
  const body: Component = {
    type: 'container',
    element: 'div',
    props: { className: 'flex max-w-3xl flex-col gap-6' },
    children: [
      // The page heading the cards sit under, routed through the same helper as
      // every other console page. Without it this page's outline began at a card
      // heading, which reads to a screen reader as a section of an absent parent.
      // The breadcrumb's own words come first — an operator arriving from
      // "Export or erase my data" should meet the page they clicked — with the
      // regime named after them, because "GDPR" is what someone hunting for
      // these controls searches the console for.
      dataPageIntro(
        'My data (GDPR)',
        'What this instance holds about you, and how to take it out or erase it.'
      ),
      identityCard(),
      {
        type: 'container',
        element: 'div',
        props: { className: 'grid gap-4 sm:grid-cols-2' },
        children: [exportCard(), eraseCard()],
      },
      pendingTable(),
      // The other half of the account. Both pages carry a cross-link: a split is
      // only an improvement while both halves stay findable from either one.
      accountCrossLink('/_admin/profile', 'Change my name, email or password'),
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
    }),
  } as Page
}
