/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Data-tab **Invitations** page (`/_admin/users/invitations`) — issue an
 * invitation, see what is outstanding, take one back.
 *
 * The lifecycle API has shipped for a while (`GET /api/admin/invitations`,
 * `POST /api/admin/invitations/:id/resend`, `DELETE /api/admin/invitations/:id`)
 * and had no console. An operator could invite someone through the admin API and
 * then had no way to answer the only two questions that follow: did it arrive,
 * and can I take it back? This page is that answer, built on the same
 * Consoles-as-Config components as every other Data surface.
 *
 * ─── WHY A SIBLING PAGE AND NOT A PANEL ON `/_admin/users` ──────────────────
 *
 * `invite-user` mints the `auth.user` row immediately and only then sends the
 * token, so an invited-but-unaccepted person is ALREADY in the account directory
 * at `/_admin/users`. Rendering the pending list beside that grid would show the
 * same address twice, in two tables, meaning two different things — "this
 * account exists" and "this invitation is outstanding" — with no way to tell
 * which row a control belonged to. The invitation lifecycle gets its own page,
 * reached by the Invite affordance on the directory.
 *
 * ─── THE ROLE PICKER IS THE WRITE BOUNDARY ──────────────────────────────────
 *
 * The options are `assignableRoleNames(app)` — the exact set
 * `validateInviteInput` accepts, and the exact set it enumerates back in its own
 * 400. Same reasoning as the directory's "Change role" picker: a picker NARROWER
 * than the boundary hides roles the app really uses (on a partner-shaped app the
 * built-ins share ZERO members with the declared roles), and a picker WIDER
 * offers a value guaranteed to be refused. Deriving both from one function is
 * the only arrangement under which they cannot disagree.
 *
 * ─── LANGUAGE ───────────────────────────────────────────────────────────────
 *
 * English, like every other console surface. `/_admin` sits outside the locale
 * namespace and no console surface is translated; adding French to this one page
 * would be the only bilingual screen in the console rather than a step towards a
 * bilingual console.
 */

import { assignableRoleNames } from '@/domain/models/app/auth/roles'
import { homeCrumb, wrapInShell } from './dashboard-shell-surface'
import { dataPageIntro } from './data-object-rail'
import type { DataShellOptions } from './data-landing-surface'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/** Id of the pending-invitations grid — the `onSuccess.refetch` target. */
const INVITATIONS_GRID_ID = 'admin-invitations-grid'

/**
 * The invite form → `POST /api/auth/admin/invite-user`.
 *
 * An endpoint-bound `form`: a plain server-rendered `<form>` whose fields are
 * collected into a JSON body by the shared client runtime, so a successful
 * submit can drive `refetch` on the grid below and the operator sees the
 * invitation appear without reloading.
 *
 * `name` is offered but not demanded. An operator inviting a teammate reliably
 * has their address and often not the spelling of their name, and the engine
 * falls back to the address's local part when it is left blank — so requiring it
 * here would be friction in front of the one thing the operator actually knows.
 */
function inviteForm(app: Readonly<App>): Component {
  return {
    type: 'form',
    props: { 'aria-label': 'Invite a teammate' },
    endpoint: {
      url: '/api/auth/admin/invite-user',
      method: 'POST',
      submitLabel: 'Send invitation',
      onSuccess: {
        type: 'toast',
        variant: 'success',
        message: 'Invitation sent',
        refetch: INVITATIONS_GRID_ID,
      },
      onError: {
        type: 'toast',
        variant: 'destructive',
        message: 'Could not send the invitation',
      },
    },
    fields: [
      { field: 'email', control: 'email', label: 'Email address' },
      { field: 'name', control: 'text', label: 'Full name (optional)' },
      {
        field: 'role',
        control: 'select',
        label: 'Role',
        options: [...assignableRoleNames(app)].toSorted().map((value) => ({ value })),
      },
    ],
  } as unknown as Component
}

/**
 * The per-row Revoke control.
 *
 * Gated by an object confirm, because revoking is irreversible in the sense that
 * matters: the link already in the invitee's inbox stops working, and they will
 * click it before anyone tells them not to. The dialog says that rather than
 * asking an abstract "are you sure?".
 *
 * Both labels are set explicitly. The confirm-gate runtime defaults its buttons
 * to French, which would drop two French words into an otherwise English
 * console; and the labels are deliberately DISJOINT from the row control's
 * ("Revoke" vs "Confirm"), so the dialog's affordance can never be mistaken —
 * by an operator or by a test — for the button that opened it.
 */
const REVOKE_ACTION = {
  label: 'Revoke',
  action: {
    type: 'fetch',
    method: 'DELETE',
    url: '/api/admin/invitations/$record.id',
    onSuccess: {
      type: 'toast',
      message: 'Invitation revoked',
      refetch: INVITATIONS_GRID_ID,
    },
  },
  confirm: {
    title: 'Revoke this invitation?',
    message:
      'The link already sent stops working immediately. You can invite this person again afterwards.',
    role: 'alertdialog',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
  },
} as const

/**
 * The per-row Resend control.
 *
 * No confirm: sending a second copy of an invitation the operator already meant
 * to send is not destructive, and gating it would put a dialog in front of the
 * most common recovery from "it never arrived".
 */
const RESEND_ACTION = {
  label: 'Resend',
  action: {
    type: 'fetch',
    method: 'POST',
    url: '/api/admin/invitations/$record.id/resend',
    onSuccess: {
      type: 'toast',
      message: 'Invitation sent again',
      refetch: INVITATIONS_GRID_ID,
    },
  },
} as const

/**
 * The outstanding-invitation grid, bound to `GET /api/admin/invitations`
 * (`{ items: [...] }`, rows keyed on the opaque `id`).
 *
 * `status` is a column rather than a filter: "expired" and "never sent" are
 * different problems with different next actions, and the endpoint deliberately
 * lists expired invitations instead of hiding them. Painting the distinction is
 * the whole reason it does.
 *
 * No search, no sort, no pager. Outstanding invitations are bounded by the token
 * TTL and by how many people one operator is onboarding at once, so the list is
 * small by construction — the same reason its response carries no cursor.
 */
function invitationsDataTable(): Component {
  return {
    type: 'data-table',
    props: {
      id: INVITATIONS_GRID_ID,
      'aria-label': 'Pending invitations',
    },
    dataSource: {
      system: {
        endpoint: '/api/admin/invitations',
        rowsKey: 'items',
        idKey: 'id',
      },
    },
    columns: [
      { field: 'email', label: 'Email' },
      { field: 'role', label: 'Role' },
      {
        field: 'status',
        label: 'Status',
        cellStyle: [
          {
            when: { eq: 'pending' },
            className: 'bg-success-bg text-success-fg rounded-full px-2 py-0.5 text-xs',
          },
          {
            when: { eq: 'expired' },
            className: 'bg-error-bg text-error-fg rounded-full px-2 py-0.5 text-xs',
          },
        ],
      },
      { field: 'invitedBy', label: 'Invited by' },
      { field: 'expiresAt', label: 'Expires' },
      {
        type: 'actions',
        label: 'Actions',
        actions: [RESEND_ACTION, REVOKE_ACTION],
      },
    ],
    emptyMessage: 'No invitations outstanding',
  } as unknown as Component
}

/** The invite form under a labelled heading, so the page reads as two sections. */
function inviteSection(app: Readonly<App>): Component {
  return {
    type: 'container',
    element: 'section',
    props: {
      'aria-label': 'Invite a teammate',
      className: 'border-border flex flex-col gap-3 rounded-lg border p-4',
    },
    children: [
      {
        type: 'text',
        element: 'h2',
        props: { className: 'text-lg font-semibold' },
        content: 'Invite a teammate',
      },
      inviteForm(app),
    ],
  } as unknown as Component
}

/**
 * Build the Invitations page (`/_admin/users/invitations`), wrapped in the
 * persistent shell. The breadcrumb keeps Users as the parent, which is where the
 * Invite affordance that leads here lives.
 */
export function buildDataInvitationsPage(options: DataShellOptions, app: Readonly<App>): Page {
  return {
    id: 'dashboard-data-invitations',
    name: 'dashboard-data-invitations',
    path: '/users/invitations',
    meta: { title: 'Sovrium — Data · Invitations' },
    components: wrapInShell(
      [
        dataPageIntro(
          'Invitations',
          'Invite someone to this app, see which invitations are still outstanding, and take one back before it is accepted.'
        ),
        inviteSection(app),
        invitationsDataTable(),
      ],
      {
        canEdit: options.canEdit,
        appName: options.appName,
        appVersion: options.appVersion,
        breadcrumb: [
          homeCrumb(options.appName),
          { label: 'Users', href: '/_admin/users' },
          { label: 'Invitations', href: '/_admin/users/invitations' },
        ],
      }
    ),
  } as Page
}
