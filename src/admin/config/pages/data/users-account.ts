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

import { CARD_SURFACE } from '../../components/card'
import { consolePage, toolbarRow } from '../../components/data-page'
import { dataTable, ledgerTable, STATUS_BADGE } from '../../components/data-table-blocks'
import { ADMIN_ROLES_ENDPOINT, USER_ACCESS_ENDPOINT, USERS_ENDPOINT } from '../../system-sources'
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
  dataTable({
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
      { field: 'email', label: '$t:admin.common.email' },
      { field: 'name', label: '$t:admin.common.name' },
      { field: 'role', label: '$t:admin.common.role' },
      { field: 'groups', label: '$t:admin.common.groups' },
      {
        field: 'banned',
        label: '$t:admin.common.status',
        valueLabels: { false: '$t:admin.users.state.active', true: '$t:admin.users.state.banned' },
        cellStyle: [
          {
            when: { eq: false },
            className: STATUS_BADGE.quiet.positive,
          },
          {
            when: { eq: true },
            className: STATUS_BADGE.quiet.negative,
          },
        ],
      },
      {
        type: 'actions',
        label: '$t:admin.common.actions',
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
            label: '$t:admin.users.endAll',
            confirm: {
              title: '$t:admin.users.endConfirm',
              message: '$t:admin.users.endMessage',
              role: 'alertdialog',
              confirmLabel: '$t:admin.users.endSessions',
              cancelLabel: '$t:admin.common.cancel',
            },
            action: {
              type: 'fetch',
              url: '/api/auth/admin/revoke-user-sessions',
              method: 'POST',
              body: { userId: '$record.id' },
              responseEnvelope: 'better-auth',
              onSuccess: { type: 'toast', message: '$t:admin.users.sessionsEnded' },
            },
          },
          {
            label: '$t:admin.users.delete',
            variant: 'destructive',
            confirm: {
              title: '$t:admin.users.deleteConfirm',
              message: '$t:admin.users.deleteMessage',
              role: 'alertdialog',
              confirmLabel: '$t:admin.users.delete',
              cancelLabel: '$t:admin.common.cancel',
            },
            action: {
              type: 'fetch',
              url: '/api/auth/admin/remove-user',
              method: 'POST',
              body: { userId: '$record.id' },
              responseEnvelope: 'better-auth',
              onSuccess: {
                type: 'toast',
                message: '$t:admin.users.deleted',
                refetch: ACCOUNT_GRID_ID,
              },
            },
          },
        ],
      },
    ],
    emptyMessage: '$t:admin.users.noAccount',
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
      dataTable({
        props: { 'aria-label': '$t:admin.users.account.roles.region' },
        dataSource: { system: { endpoint: ADMIN_ROLES_ENDPOINT, rowsKey: 'roles', idKey: 'name' } },
        // The description the app wrote for each role in `auth.roles[]`: what
        // choosing it means, read beside the name rather than guessed from it.
        columns: [
          { field: 'name', label: '$t:admin.common.role' },
          { field: 'description', label: '$t:admin.users.canDo' },
        ],
        emptyMessage: '$t:admin.users.noRoles',
      }),
    ],
  }) as PageComponent

/**
 * The records of scope tables this account has been granted, READ-ONLY.
 *
 * Narrowed by the address in the URL (`?user_email=`) because the address is
 * all this page knows — the account's id only exists on the row the grid above
 * resolves. Each grant carries its records' display values beside their ids, so
 * the Records column reads names.
 *
 * The listing route also answers PATCH and DELETE, and nothing here binds
 * either: the console reads grants and never changes them. The line
 * under the heading says where they do change, which is the whole of the
 * answer to "where is the revoke button?". Every column is unsortable for the
 * same reason the region holds no textbox: a header button would be the one
 * control in a section whose contract is that it has none.
 *
 * On an app that declares no `auth.scopeTables` the read answers an empty list,
 * so the section reads its empty state rather than an error.
 */
const accessGrants = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: {
      'aria-label': '$t:admin.users.account.access.region',
      className: 'flex flex-col gap-3',
    },
    children: [
      {
        type: 'text',
        element: 'h2',
        props: { className: 'text-foreground text-md font-medium' },
        content: '$t:admin.users.account.access.heading',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-muted-foreground max-w-2xl text-sm leading-relaxed' },
        content: '$t:admin.users.account.access.body',
      },
      ledgerTable({
        props: { 'aria-label': '$t:admin.users.account.access.grid' },
        dataSource: {
          system: {
            endpoint: USER_ACCESS_ENDPOINT,
            rowsKey: 'records',
            idKey: 'id',
            query: { user_email: '$param.email' },
          },
        },
        columns: [
          { field: 'table_slug', label: '$t:admin.common.table', sortable: false },
          { field: 'record_labels', label: '$t:admin.common.records', sortable: false },
          { field: 'role', label: '$t:admin.common.role', sortable: false },
          {
            field: 'created_at',
            label: '$t:admin.users.granted',
            format: 'short-date',
            sortable: false,
          },
        ],
        emptyMessage: '$t:admin.users.noAccess',
      }),
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
      className: `${CARD_SURFACE} flex flex-col gap-1 p-4`,
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
        props: { className: 'text-muted-foreground max-w-2xl text-md leading-relaxed' },
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
      className: 'text-muted-foreground hover:text-foreground text-sm underline',
    },
  }) as PageComponent

/**
 * `/users/:email` — one account, and everything the console may do to it.
 *
 * It is NOT a tabbed page: there is one subject and no second question to put
 * beside it, so it takes the plain body the developer surfaces use.
 */
export const accountPage: PageConfig = consolePage({
  id: 'dashboard-data-user-account',
  path: '/users/:email',
  title: '$t:admin.meta.userAccount',
  heading: ['$t:admin.users.account.heading', '$t:admin.users.account.blurb'],
  shell: { breadcrumb: { users: '$t:admin.crumb.users' } },
  body: [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-col gap-6 pt-2' },
      children: [
        toolbarRow([backToDirectory()]),
        accountGrid(),
        accessGrants(),
        assignableRoles(),
        accountGaps(),
      ],
    } as PageComponent,
  ],
})
