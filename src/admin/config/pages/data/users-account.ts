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

import { consolePage } from '../../components/data-page'
import { ledgerTable } from '../../components/data-table-blocks'
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
// from the resolved ROW (`$record.id`) rather than from the URL — which is why
// the write buttons sit under the same one-row read as the facts: a page with
// no `dataSource` has no `$record` for a button to read.
//
// The identity prints as labelled facts from that row, and the writes are
// labelled buttons above it, the two pickers among them. When `GET /api/admin/users/:id` ships, this page binds it as a
// page-level system record and the segment becomes the id.
//
// ─── WHAT THIS PAGE DOES NOT SHOW ──────────────────────────────────────────
//
// Open sessions and last activity. `POST /api/auth/admin/list-user-sessions`
// returns the sessions, but a `dataSource.system` read issues a GET, so a
// POST-only list has no binding; last activity needs the session table joined
// into the directory, which no read does. Neither is drawn — not as a figure,
// and not as a paragraph explaining its absence: the page shows what it has.
// Ending every session IS here, among the account's actions.
//
// The directory row carries `groups` and `PUT /api/admin/users/:userId/groups`
// sets them, so membership is a column and a row action like the role beside
// it.

/** The actions group's id — re-read by every write, so Ban and Lift ban swap. */
const ACCOUNT_ACTIONS_ID = 'admin-user-account-actions'

/**
 * The facts region's id. Every write below re-reads it beside the grid, so the
 * Role, Groups and Status facts change with the action that changed them.
 */
const ACCOUNT_FACTS_ID = 'admin-user-account-facts'

/** What a write on this page re-reads: the actions group and the facts. */
const ACCOUNT_REFETCH = [ACCOUNT_ACTIONS_ID, ACCOUNT_FACTS_ID] as const

/** One fact of the account: a term and its value, side by side from `sm`. */
const fact = (term: string, value: PageComponent): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4' },
    children: [
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-sm text-muted-foreground' },
        content: term,
      },
      value,
    ],
  }) as PageComponent

const factText = (content: string, className = ''): PageComponent =>
  ({
    type: 'text',
    element: 'span',
    props: { className: `min-w-0 text-sm text-foreground ${className}`.trim() },
    content,
  }) as PageComponent

/**
 * The account as labelled facts — email, name, role, groups, status — read
 * from the directory's one row for this address. A row template renders its
 * children once per row, so the facts exist when the account does and a failed
 * read leaves them out rather than taking the page down.
 *
 * The status reads twice under complementary row gates, so it prints the
 * word ("Active", "Banned") rather than the stored boolean.
 */
const accountFacts = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: {
      'aria-label': '$t:admin.users.account.facts.region',
      className: 'rounded-xl ring-1 ring-foreground/10',
    },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { id: ACCOUNT_FACTS_ID, className: 'contents [&>li]:list-none' },
        dataSource: {
          system: {
            endpoint: USERS_ENDPOINT,
            rowsKey: 'users',
            idKey: 'id',
            query: { q: '$param.email', limit: '1' },
          },
        },
        children: [
          {
            type: 'container',
            element: 'div',
            props: { className: 'divide-y', 'data-testid': 'user-account-facts' },
            children: [
              fact('$t:admin.common.email', factText('$record.email', 'break-all')),
              fact('$t:admin.common.name', factText('$record.name')),
              // Role and groups as the console calls them, never their ids.
              fact('$t:admin.common.role', factText('$record.roleLabel')),
              fact('$t:admin.common.groups', factText('$record.groupLabels')),
              fact('$t:admin.common.status', {
                type: 'container',
                element: 'div',
                children: [
                  {
                    type: 'badge',
                    badgeVariant: 'secondary',
                    visibility: { record: { field: 'banned', eq: false } },
                    content: '$t:admin.users.state.active',
                  },
                  {
                    type: 'badge',
                    badgeVariant: 'destructive',
                    visibility: { record: { field: 'banned', eq: true } },
                    content: '$t:admin.users.state.banned',
                  },
                ],
              } as PageComponent),
            ],
          },
        ],
      },
    ],
  }) as PageComponent

/** The actions' row: shadcn's button group spacing, wrapping on a phone. */
const BUTTON_ROW = 'flex flex-wrap items-center gap-2'

/** A row write, re-used as a button: the same label, picker, confirm and action. */
const actionButton = (
  item: Readonly<Record<string, unknown>>,
  variant: 'outline' | 'destructive' = 'outline'
): PageComponent => {
  const { label, editSelect, confirm, action, visibleWhen } = item as {
    readonly label: string
    readonly editSelect?: unknown
    readonly confirm?: unknown
    readonly action: unknown
    readonly visibleWhen?: { readonly field: string; readonly eq: boolean }
  }
  return {
    type: 'button',
    label,
    variant,
    size: 'sm',
    props: { type: 'button' },
    ...(editSelect === undefined ? {} : { editSelect }),
    ...(confirm === undefined ? {} : { confirm }),
    ...(visibleWhen === undefined
      ? {}
      : { visibility: { record: { field: visibleWhen.field, eq: visibleWhen.eq } } }),
    action,
  } as PageComponent
}

/**
 * The account's writes, as labelled buttons at the head of the page — Change
 * role, Change groups, Ban (Lift ban once banned), End all sessions, Delete
 * account — named where they stand, each one gesture.
 *
 * The buttons sit under the same one-row directory read the facts use, so each
 * reads `$record.id` and the two pickers open pre-filled from the account's
 * own role and groups. Every write re-reads this group and the facts, so the
 * Ban / Lift ban swap and the Role, Groups and Status facts follow the action.
 *
 * Drawn for an account administrator only (`administer-accounts`): every
 * endpoint behind them answers 404 to anyone else, so for anyone else the
 * group is absent rather than a row of buttons that fail.
 */
const accountActions = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    visibility: { capability: 'administer-accounts' },
    props: { id: ACCOUNT_ACTIONS_ID, className: 'contents [&>li]:list-none' },
    dataSource: {
      system: {
        endpoint: USERS_ENDPOINT,
        rowsKey: 'users',
        idKey: 'id',
        query: { q: '$param.email', limit: '1' },
      },
    },
    children: [
      {
        type: 'container',
        element: 'div',
        props: {
          role: 'group',
          'aria-label': '$t:admin.users.account.actions.region',
          className: BUTTON_ROW,
        },
        children: [
          actionButton(changeRoleAction(ACCOUNT_REFETCH)),
          actionButton(changeGroupsAction(ACCOUNT_REFETCH)),
          actionButton(banAction(ACCOUNT_REFETCH), 'destructive'),
          actionButton(liftBanAction(ACCOUNT_REFETCH)),
          // Confirmed, because it signs the person out of every device at
          // once and they will discover it rather than be told. Reversible in
          // the sense that they can sign in again, so a confirm and not a
          // type-to-confirm.
          actionButton({
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
          }),
          // The one gesture that removes the account rather than changing it:
          // destructive, confirmed, and it leaves for the directory, since this
          // page would name no one.
          actionButton(
            {
              label: '$t:admin.users.delete',
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
                  navigate: '/users',
                },
              },
            },
            'destructive'
          ),
        ],
      },
    ],
  }) as PageComponent

/**
 * Every role this app may assign, READ-ONLY, as one row of chips.
 *
 * The same `GET /api/admin/roles` the pickers bind, each role by its label,
 * printed rather than offered as a control: the role picker on the account row is where a role is chosen,
 * and this is the answer to "what could it be?" — which on a partner-shaped app
 * is a set the built-ins share no member with. The caption names where the set
 * comes from, because the console reads it and never writes it.
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
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-wrap items-center gap-2' },
        children: [
          {
            type: 'container',
            element: 'div',
            // Each row is drawn as a list item; `contents` lets the chips sit
            // in the same wrapping row as the caption after them.
            props: { className: 'contents [&>li]:list-none' },
            dataSource: {
              system: { endpoint: ADMIN_ROLES_ENDPOINT, rowsKey: 'roles', idKey: 'name' },
            },
            children: [
              {
                type: 'badge',
                // shadcn's outline badge: a fact to read, not a status to notice.
                props: { className: 'border-border bg-background text-foreground' },
                // The role's label — the words the directory and the invite
                // dialog use — never its identifier.
                content: '$record.label',
              },
            ],
          },
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-muted-foreground text-sm' },
            content: '$t:admin.users.account.roles.source',
          },
        ],
      },
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
 *
 * Drawn for an account administrator only: that is the one reader the grants
 * listing answers, so for anyone else the section would be a read that fails.
 */
const accessGrants = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    visibility: { capability: 'administer-accounts' },
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
        // The line and the way to the whole picture: the grants below are the
        // records this account holds, and Organisation › Reach is where every
        // path to a table — roles, teams, grants — is drawn together.
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-wrap items-start justify-between gap-3' },
        children: [
          {
            type: 'text',
            element: 'p',
            props: { className: 'text-muted-foreground max-w-xl text-sm leading-relaxed' },
            content: '$t:admin.users.account.access.body',
          },
          {
            type: 'link',
            visibility: { declares: 'data' },
            props: {
              href: '/organisation?tab=reach',
              className:
                'text-foreground border-border hover:bg-muted inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium',
            },
            content: '$t:admin.users.account.access.reach',
          },
        ],
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
  // Full width, like the Users directory it opens from: a reading cap here left
  // a wide empty margin beside cards that are tables of facts, not prose.
  shell: { breadcrumb: { users: '$t:admin.crumb.users' } },
  body: [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-col gap-6 pt-2' },
      children: [accountActions(), accountFacts(), accessGrants(), assignableRoles()],
    } as PageComponent,
  ],
})
