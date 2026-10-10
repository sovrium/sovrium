/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Users — one account, at `/users/:email`.
//
// Its own module rather than the back half of `users.ts`: the directory and
// this page answer different questions — every account, and everything the
// console may do to ONE — and share nothing but the row writes, which both
// build from `users-row-actions.ts`. `users.ts` imports the page and lists it
// last, where the route order needs it.

import { pageHeading, toolbarRow } from '../../components/data-page'
import { withShell } from '../../components/shell'
import { ADMIN_ROLES_ENDPOINT, USERS_ENDPOINT } from '../../system-sources'
import { banAction, changeGroupsAction, changeRoleAction, liftBanAction } from './users-row-actions'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

// ─── ONE ACCOUNT: `/users/:email` ──────────────────────────────────────────
//
// ─── WHY THE SEGMENT IS AN EMAIL AND NOT AN ID ─────────────────────────────
//
// The canvas addresses this page `/users/:id`, and that address cannot resolve.
// Measured, both halves:
//
//   - there is **no `GET /api/admin/users/:id`** — the whole `/api/admin/users`
//     surface is the directory, its overview, and nothing else;
//   - the directory's `?q=` searches **email and name only**. Asked for the
//     admin's own id it answers `total: 0`. So a page handed an id has no read
//     that can turn it back into an account.
//
// An email does resolve, through the read that already ships, so that is the
// segment. The ID is still what every write needs, and every write here takes it
// from the resolved ROW (`$record.id`) rather than from the URL — which is also
// why the writes live in the grid's action column instead of as page-level
// buttons: a page with no `dataSource` has no `$record` for a button to read.
//
// When `GET /api/admin/users/:id` ships, this page binds it as a page-level
// system record, the segment becomes the id, and the identity grid collapses
// into printed fields.
//
// ─── WHAT THIS PAGE CANNOT SHOW, AND WHY EACH ONE IS DRAWN AS A GAP ────────
//
// `POST /api/auth/admin/list-user-sessions` returns the open sessions and
// `revoke-user-sessions` ends them. The second is authorable — a `fetch` action
// is a POST. The FIRST is not: a `dataSource.system` read issues a GET, so a
// POST-only list has no binding at all. The console can therefore end every
// session and never show one, which is exactly what this page does and says.
//
// Last activity needs the session table joined into the directory
// (`?include=lastActiveAt`, absent). Both are worded gaps with NO figure, never
// a tile reading zero — the footprint page's instrument rule.
//
// The directory row carries `groups` and `PUT /api/admin/users/:userId/groups`
// sets them, so membership is a column and a row action like the role beside
// it, and this page lists only the two gaps that remain: open sessions and
// last activity.

/** The account grid's id — the `refetch` target of every write on this page. */
const ACCOUNT_GRID_ID = 'admin-user-account'

/**
 * The one account, as the directory narrowed to it.
 *
 * `?q=` matches email AND name, so a name containing the address would widen
 * this to two rows. It is the narrowest read that exists; the page is honest
 * about being a filtered directory rather than pretending to a detail endpoint.
 */
const accountGrid = (): PageComponent =>
  ({
    type: 'table',
    props: { id: ACCOUNT_GRID_ID, 'aria-label': '$t:admin.users.account.region' },
    dataSource: {
      system: {
        endpoint: USERS_ENDPOINT,
        rowsKey: 'users',
        idKey: 'id',
        query: { q: '$param.email' },
      },
    },
    columns: [
      { field: 'email', label: 'Email' },
      { field: 'name', label: 'Name' },
      { field: 'role', label: 'Role' },
      { field: 'groups', label: 'Groups' },
      {
        field: 'banned',
        label: 'Status',
        valueLabels: { false: 'active', true: 'banned' },
        cellStyle: [
          {
            when: { eq: false },
            className: 'bg-success-bg text-success-fg rounded-full px-2 py-0.5 text-sm',
          },
          {
            when: { eq: true },
            className: 'bg-error-bg text-error-fg rounded-full px-2 py-0.5 text-sm',
          },
        ],
      },
      {
        type: 'actions',
        label: 'Actions',
        // The same whole-column gate the directory uses: every endpoint behind
        // these six 404s an admin-tier but not admin-EQUIVALENT operator — the
        // five on `/api/auth/admin/*`, and the membership write beside them.
        capability: 'administer-accounts',
        // TWO items here name the danger weight where the directory names one:
        // this column also carries Delete account, which is the only gesture in
        // the console that removes the row rather than changing it. `End all
        // sessions` stays neutral on its own comment's reasoning — the person
        // signs in again — and `Lift ban` stays neutral because it is a repair.
        actions: [
          changeRoleAction(ACCOUNT_GRID_ID),
          changeGroupsAction(ACCOUNT_GRID_ID),
          banAction(ACCOUNT_GRID_ID),
          liftBanAction(ACCOUNT_GRID_ID),
          {
            // Confirmed, because it signs the person out of every device at once
            // and they will discover it rather than be told. Reversible in the
            // sense that they can sign in again — which is why it is a confirm
            // and not the type-to-confirm the deletion below would want.
            label: 'End all sessions',
            confirm: {
              title: 'End every session for this account?',
              message:
                'They are signed out on every device immediately. Nothing else changes and they can sign in again.',
              role: 'alertdialog',
              confirmLabel: 'End sessions',
              cancelLabel: 'Cancel',
            },
            action: {
              type: 'fetch',
              url: '/api/auth/admin/revoke-user-sessions',
              method: 'POST',
              body: { userId: '$record.id' },
              responseEnvelope: 'better-auth',
              onSuccess: { type: 'toast', message: 'Sessions ended' },
            },
          },
          {
            label: 'Delete account',
            variant: 'destructive',
            confirm: {
              title: 'Delete this account?',
              message:
                'The account and its sessions are removed. Records they authored keep their author field. This cannot be undone.',
              role: 'alertdialog',
              confirmLabel: 'Delete account',
              cancelLabel: 'Cancel',
            },
            action: {
              type: 'fetch',
              url: '/api/auth/admin/remove-user',
              method: 'POST',
              body: { userId: '$record.id' },
              responseEnvelope: 'better-auth',
              onSuccess: { type: 'toast', message: 'Account deleted', refetch: ACCOUNT_GRID_ID },
            },
          },
        ],
      },
    ],
    emptyMessage: 'No account with this address',
  }) as PageComponent

/**
 * Every role this app may assign, READ-ONLY.
 *
 * The same `GET /api/admin/roles` the pickers bind, printed as a list rather
 * than offered as a control: the picker in the row above is where a role is
 * chosen, and this is the answer to "what could it be?" — which on a partner-
 * shaped app is a set the built-ins share no member with. Roles are declared in
 * `auth.roles[]` and the console never writes configuration, so there is no
 * affordance here and none is missing.
 */
const assignableRoles = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: {
      'aria-label': '$t:admin.users.account.roles.region',
      className: 'flex flex-col gap-3',
    },
    children: [
      {
        type: 'text',
        element: 'h2',
        props: { className: 'text-foreground text-md font-medium' },
        content: '$t:admin.users.account.roles.heading',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle max-w-2xl text-sm leading-relaxed' },
        content: '$t:admin.users.account.roles.body',
      },
      {
        type: 'table',
        props: { 'aria-label': '$t:admin.users.account.roles.region' },
        dataSource: { system: { endpoint: ADMIN_ROLES_ENDPOINT, rowsKey: 'roles', idKey: 'name' } },
        columns: [{ field: 'name', label: 'Role' }],
        emptyMessage: 'This app declares no roles',
      },
    ],
  }) as PageComponent

/**
 * One worded gap: what the console cannot show here, and the read that would
 * close it. No figure, ever — a tile reading zero is a wrong answer where an
 * absent one is the truth.
 */
const gapCard = (heading: string, body: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'border-border bg-background-raised flex flex-col gap-1 rounded-lg border p-4',
    },
    children: [
      {
        type: 'text',
        element: 'h3',
        props: { className: 'text-foreground text-md font-medium' },
        content: heading,
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-muted max-w-2xl text-md leading-relaxed' },
        content: body,
      },
    ],
  }) as PageComponent

/** The two gaps, side by side, under one heading. */
const accountGaps = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: {
      'aria-label': '$t:admin.users.account.gaps.region',
      className: 'flex flex-col gap-3',
    },
    children: [
      {
        type: 'text',
        element: 'h2',
        props: { className: 'text-foreground text-md font-medium' },
        content: '$t:admin.users.account.gaps.heading',
      },
      {
        type: 'container',
        props: { className: 'grid grid-cols-1 gap-4 lg:grid-cols-2' },
        children: [
          gapCard(
            '$t:admin.users.account.gaps.sessions.heading',
            '$t:admin.users.account.gaps.sessions.body'
          ),
          gapCard(
            '$t:admin.users.account.gaps.activity.heading',
            '$t:admin.users.account.gaps.activity.body'
          ),
        ],
      } as PageComponent,
    ],
  }) as PageComponent

/** Back to the directory — the only way out of a page with no sidebar row. */
const backToDirectory = (): PageComponent =>
  ({
    type: 'link',
    content: '$t:admin.users.account.back',
    props: {
      href: '/users',
      className: 'text-foreground-muted hover:text-foreground text-sm underline',
    },
  }) as PageComponent

/**
 * `/users/:email` — one account, and everything the console may do to it.
 *
 * It is NOT a tabbed page: there is one subject and no second question to put
 * beside it, so it takes the plain body the developer surfaces use.
 */
export const accountPage: PageConfig = withShell(
  {
    id: 'dashboard-data-user-account',
    name: 'dashboard-data-user-account',
    path: '/users/:email',
    // The title cannot name the account: the route-param pass walks `components`
    // and `layout`, deliberately not `meta`, at parity with the `$query` and
    // `$app` passes.
    meta: { title: '$t:admin.meta.userAccount', lang: 'en-US' },
    components: [
      pageHeading('$t:admin.users.account.heading', '$t:admin.users.account.blurb'),
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-col gap-6 pt-2' },
        children: [
          toolbarRow([backToDirectory()]),
          accountGrid(),
          assignableRoles(),
          accountGaps(),
        ],
      } as PageComponent,
    ],
  } as PageConfig,
  { breadcrumb: { users: '$t:admin.crumb.users' } }
)
