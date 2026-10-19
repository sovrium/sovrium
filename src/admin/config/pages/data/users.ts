/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Users — the account directory, and the invitation lifecycle beside it.
//
// TWO pages, because they answer two questions that must not share a table:
//
//   `/users`              every account this app has, with the account
//                         writes an administrator may make on one.
//   `/users/invitations`  who has been invited and has not accepted yet.
//
// ─── WHY INVITATIONS IS A TAB AND NO LONGER A SEPARATE DESTINATION ─────────
//
// It WAS a sibling page, and the argument for that was sound: `invite-user`
// mints the `auth.user` row immediately and only then sends the token, so an
// invited-but-unaccepted person is ALREADY in the directory above. Rendering
// the pending list BESIDE that grid would show the same address twice, in two
// tables, meaning two different things — "this account exists" and "this
// invitation is outstanding" — with no way to tell which row a control
// belonged to.
//
// That argument is against showing them SIMULTANEOUSLY, and a tab strip is
// precisely the arrangement that does not: exactly one of the two tables is in
// the document at a time, each under a caption naming which question it
// answers. What the split cost was the comparison — an operator asking "did
// this person accept?" read the directory, navigated away, lost their filter,
// and read the other list. One route, two tabs, one breadcrumb.
//
// `/users/invitations` REMAINS A ROUTE. It is the same page opened on the other
// tab, so every bookmark and every link into it still lands where it did. It is
// not a redirect: `redirects[]` is inert under the console mount — it decodes,
// ships inside the preset, and both `/_admin/<from>` and `/<from>` answer 404 —
// so a 301 was never available here and a retained page is what replaces it.
//
// ─── WHAT IT TOOK TO WRITE THIS AS CONFIG ──────────────────────────────────
//
// Two things, and both were platform gaps rather than authoring problems.
//
// The row action column and the Invite affordance are painted only for a caller
// who is admin-EQUIVALENT: every endpoint behind them lives on
// `/api/auth/admin/*`, which 404s an admin-TIER-but-not-equivalent operator, so
// painting them for an `admin-viewer` would be three controls their own backend
// refuses. `capability` on the action column and `visibility.capability` on the
// button say that — but both derive the caller's powers from a session, and a
// MOUNTED page renders session-less, so both were inert here and inert in the
// direction that hid the affordance from the administrator it was written for.
// The mount now states the caller's POWERS (`callerCapabilities`) rather than
// handing over the session; see `holdsCapability` in
// `presentation/rendering/visibility-filter.ts` for why that distinction is the
// whole design.
//
// And both role pickers offer `assignableRoleNames(app)` — the built-ins, the
// admin-tier names, and every name the OPERATOR declared. That set is computed
// from the auth config and stored in no table, so a literal list cannot reach
// it: narrowing this picker to the built-ins was measured on a partner-shaped
// app to share ZERO members with the roles that app declares. `optionsSource`
// over `GET /api/admin/roles` is what makes the affordance and the write
// boundary one set, which is the only arrangement under which they cannot
// disagree.
//
// Accounts are OBSERVED and administered here; creating one goes through the
// admin API (Developers → API), which is why there is no create form.

import { sectionCard } from '../../components/dashboard-blocks'
import { consolePage, kpiStrip, tabPanel, toolbarRow } from '../../components/data-page'
import { dataTable, STATUS_BADGE, toolbarSearch } from '../../components/data-table-blocks'
import { USERS_ENDPOINT, USERS_OVERVIEW_ENDPOINT } from '../../system-sources'
import { accountPage } from './users-account'
import {
  ROLE_OPTIONS_SOURCE,
  banAction,
  changeGroupsAction,
  changeRoleAction,
  liftBanAction,
} from './users-row-actions'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** Id of the directory grid — the `onSuccess.refetch` target of every row write. */
const USERS_GRID_ID = 'admin-users-grid'

/** The channel the directory's search box publishes on and its grid listens to. */
const USERS_CHANNEL = 'users-filter'

/** Id of the pending-invitations grid — its own `onSuccess.refetch` target. */
const INVITATIONS_GRID_ID = 'admin-invitations-grid'

/** The invite dialog's id: what both Invite buttons open. */
const INVITE_DIALOG_ID = 'admin-invite-dialog'

/**
 * The always-visible directory columns — the READ half, painted for every
 * caller who reaches the console ([internal ref]: it is a read-only operational data
 * console before it is anything else).
 *
 * `name` is a rendered column because it is one of the two `?q=` search keys.
 * A row that matches on a field the operator cannot see is a quieter version of
 * the bug the column exists to fix: a result with no legible reason why it
 * matched. Email leads anyway — it is the directory's primary key in practice
 * and is always present, whereas `name` is coalesced to '' for an account
 * created without one.
 *
 * `banned` is relabelled at RENDER time: the endpoint returns the raw boolean,
 * so `valueLabels` is never a server mutation.
 */
const USERS_COLUMNS = [
  { field: 'email', label: '$t:admin.common.email' },
  { field: 'name', label: '$t:admin.common.name' },
  {
    // The role as the console calls it (`roleLabel`, beside the `role` every
    // write takes). Not a sort key: the read orders by the name, which would
    // not be the order of the words shown, and it refuses `sort=roleLabel`.
    field: 'roleLabel',
    label: '$t:admin.common.role',
    sortable: false,
  },
  {
    // Not a sort key: an account holds a SET of groups, and the directory read
    // orders by one value per row, so it refuses `sort=groups` with a 400.
    // Shown by their labels, one per group, in the order of the names.
    field: 'groupLabels',
    label: '$t:admin.common.groups',
    sortable: false,
  },
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
    // The drill-down into one account, in a column of its OWN and deliberately
    // UNGATED.
    //
    // ─── WHY AN ACTION ITEM AND NOT `onRowClick` ─────────────────────────────
    //
    // It shipped as `onRowClick: { type: 'navigate' }` and that was a
    // regression: a row click and a row-action column cannot coexist, because
    // the row's handler fires first and turns every button in the column into a
    // navigation. Measured — clicking Ban landed on `/users/<email>` with no
    // confirm ever armed — and it took five previously green specs red
    // (`…-[internal ref]` and `-REGRESSION`). An action item is
    // also the better affordance: a row click is reachable by pointer only,
    // this is a button in the tab order with an accessible name.
    //
    // ─── WHY A SECOND COLUMN RATHER THAN A SIXTH ITEM IN THE NEXT ONE ───────
    //
    // The column below is gated on `administer-accounts`, and rightly: every
    // endpoint behind it 404s a caller without that power. Opening an account
    // is a READ, which every caller who reaches this console may do. Folding
    // Open into the gated column would hide the console's only route to
    // `/users/:email` from exactly the operator who is allowed to read it.
    type: 'actions',
    label: '$t:admin.users.col.account',
    // `mode: 'navigate'` on a FETCH action: a top-level `type: 'navigate'` is
    // INERT on a button, because the dispatcher emits data attributes for
    // `automation` / `auth` / `crud` / `fetch` only. Same lever the Invite
    // affordance below uses, and for the same reason.
    actions: [
      {
        label: '$t:admin.common.open',
        action: { type: 'fetch', mode: 'navigate', url: '/users/$record.email' },
      },
    ],
  },
  {
    type: 'actions',
    label: '$t:admin.common.actions',
    // The whole column, or nothing. Gating the items individually would
    // leave a labelled "Actions" header over empty cells — a column
    // announcing a power the caller does not have, which is the greyed-out
    // button in another spelling. Exclusion is also what keeps the
    // endpoints out of `data-island-props` for a caller forbidden to call them.
    capability: 'administer-accounts',
    // ─── ONE ITEM IN THIS COLUMN NAMES ITS WEIGHT, AND ONLY ONE ─────────────
    //
    // A row action paints `neutral` unless it says otherwise, and that default
    // is deliberate: the trigger opens a QUESTION, and a column of red buttons
    // down the side of a directory makes the question look already answered.
    //
    // Ban is the exception the platform's own recipe names. It is the one
    // gesture here whose consequence is not a value changing but a person
    // losing access — every session ends, sign-in is refused — and it is
    // announced to nobody: the account discovers it. The weight is the claim
    // that this is that kind of action, and it is made per item rather than per
    // column so the reversible gestures beside it keep receding.
    //
    // `Lift ban` deliberately says nothing. It is the REVERSAL, and reddening
    // it would paint the recovery in the colour of the harm.
    actions: [
      changeRoleAction(USERS_GRID_ID),
      changeGroupsAction(USERS_GRID_ID),
      banAction(USERS_GRID_ID),
      liftBanAction(USERS_GRID_ID),
    ],
  },
] as const

/**
 * The Invite gesture: the page's primary action, last in the control row.
 *
 * It opens the invite DIALOG on the page the operator is reading, rather than
 * sending them to another half of it. Inviting is one short form; a dialog keeps
 * the directory behind it in view, and closing it lands exactly where they were.
 * The click is the dialog's own trigger (`interactions.click.modal`), a
 * declaration rather than a script.
 */
const inviteAffordance = (): PageComponent =>
  ({
    type: 'button',
    label: '$t:admin.users.invite.open',
    visibility: { capability: 'administer-accounts' },
    props: { interactions: { click: { modal: INVITE_DIALOG_ID } } },
  }) as PageComponent

/**
 * The directory as CSV: this same endpoint's `?format=csv`, saved as a file.
 */
const exportAffordance = (): PageComponent =>
  ({
    type: 'button',
    label: '$t:admin.common.exportCsv',
    variant: 'outline',
    action: {
      type: 'fetch',
      mode: 'download',
      url: `${USERS_ENDPOINT}?format=csv`,
      filename: 'users.csv',
    },
    props: { className: 'sm:ml-auto' },
  }) as PageComponent

/**
 * One account figure, read as a pre-computed scalar from the users-overview
 * envelope, in one of dashboard-01's section cards. A failed read degrades to the neutral em-dash placeholder rather
 * than to a zero, which would be a wrong answer rather than an absent one.
 */
const overviewKpi = (label: string, valuePath: string): PageComponent =>
  sectionCard({ label, endpoint: USERS_OVERVIEW_ENDPOINT, valuePath })

/** The three account figures, over the directory. Same endpoint, so one request. */
const accountFigures = (): PageComponent =>
  kpiStrip('$t:admin.users.metrics.region', [
    overviewKpi('$t:admin.users.kpi.accounts', 'totals.users'),
    overviewKpi('$t:admin.users.kpi.active', 'totals.active_24h'),
    overviewKpi('$t:admin.users.kpi.new', 'totals.new_in_period'),
  ])

/**
 * The directory grid.
 *
 * `totalKey` is load-bearing: without it the grid counts the rows it was
 * handed, so a page of 25 out of 33 accounts reported "1–25 of 25" with Next
 * disabled over the eight it was hiding. The endpoint reports how many accounts
 * MATCH; the pager needs that number, not this page's length.
 *
 * Search goes to the SERVER — the search box above publishes `q` on
 * {@link USERS_CHANNEL}, the grid sends it to the endpoint over email and name,
 * and the response's `appliedQuery` is what tells it the narrowing already ran
 * so it must not repeat it in memory over the page it holds.
 */
const usersGrid = (): PageComponent =>
  dataTable({
    props: { id: USERS_GRID_ID, 'aria-label': '$t:admin.users.region' },
    dataSource: {
      system: {
        endpoint: USERS_ENDPOINT,
        rowsKey: 'users',
        idKey: 'id',
        totalKey: 'total',
        bindTo: USERS_CHANNEL,
        sharedFilter: {},
      },
    },
    columns: USERS_COLUMNS,
    pagination: { pageSize: 25 },
    // The grid owns the scroll: the invite row and the KPI strip above it keep
    // their natural height, the rows take the rest, and the pager stays on
    // screen instead of sitting below twenty-five rows of directory.
    layout: 'fill',
    emptyMessage: '$t:admin.users.empty',
    noMatchMessage: '$t:admin.users.noMatch',
  }) as PageComponent

/**
 * The invite form → `POST /api/auth/admin/invite-user`.
 *
 * An endpoint-bound `form`: a server-rendered `<form>` whose fields the shared
 * client runtime collects into a JSON body, so a successful submit can drive
 * `refetch` on the grid below and the invitation appears without a reload.
 *
 * `name` is offered but not demanded. An operator inviting a teammate reliably
 * has their address and often not the spelling of their name, and the engine
 * falls back to the address's local part when it is blank — so requiring it
 * would put friction in front of the one thing the operator actually knows.
 */
const inviteForm = (): PageComponent =>
  ({
    type: 'form',
    // The dialog is the frame: the form's own card border is dropped inside it.
    props: {
      'aria-label': '$t:admin.invitations.form.region',
      className: 'border-0 bg-transparent p-0',
    },
    endpoint: {
      url: '/api/auth/admin/invite-user',
      method: 'POST',
      submitLabel: '$t:admin.users.invite.send',
      // The toast names who was invited, read off the answer; `reset` empties
      // the form and puts the caret back on the address for the next one.
      onSuccess: {
        type: 'toast',
        variant: 'success',
        message: '$t:admin.invitations.sent',
        refetch: INVITATIONS_GRID_ID,
        close: true,
        reset: true,
      },
      onError: { type: 'toast', variant: 'destructive', message: '$t:admin.users.invite.failed' },
    },
    fields: [
      { field: 'email', control: 'email', label: '$t:admin.users.invite.email' },
      { field: 'name', control: 'text', label: '$t:admin.users.invite.name' },
      // The picker IS the write boundary: `validateInviteInput` accepts exactly
      // this set and enumerates it back in its own 400.
      // Preselected on `viewer`, the least-privileged role every app carries:
      // an invitation sent without a second look grants the least, never the
      // most. Choosing more is a deliberate step.
      {
        field: 'role',
        control: 'select',
        label: '$t:admin.common.role',
        optionsSource: ROLE_OPTIONS_SOURCE,
        defaultValue: 'viewer',
      },
    ],
  }) as PageComponent

/**
 * The invite dialog: the form, opened from either half's Invite button.
 *
 * Inviting is an account administration: `invite-user` answers only an
 * admin-equivalent caller, so nobody else is offered the dialog either. A sent
 * invitation closes it and clears it, and the invitations grid refreshes behind.
 */
const inviteDialog = (): PageComponent =>
  ({
    type: 'dialog',
    title: '$t:admin.invitations.form.region',
    description: '$t:admin.invitations.form.blurb',
    visibility: { capability: 'administer-accounts' },
    props: { id: INVITE_DIALOG_ID },
    children: [inviteForm()],
  }) as PageComponent

/**
 * The outstanding-invitation grid.
 *
 * `status` is a column rather than a filter: "expired" and "never sent" are
 * different problems with different next actions, and the endpoint deliberately
 * LISTS expired invitations instead of hiding them. Painting the distinction is
 * the whole reason it does.
 *
 * No search, no pager. Outstanding invitations are bounded by the token TTL and
 * by how many people one operator onboards at once, so the list is small by
 * construction — the same reason its response carries no cursor.
 */
const invitationsGrid = (): PageComponent =>
  dataTable({
    props: { id: INVITATIONS_GRID_ID, 'aria-label': '$t:admin.invitations.pending.region' },
    dataSource: {
      system: { endpoint: '/api/admin/invitations', rowsKey: 'items', idKey: 'id' },
    },
    columns: [
      { field: 'email', label: '$t:admin.common.email' },
      // The role as the console calls it (`roleLabel`), as the directory shows it.
      { field: 'roleLabel', label: '$t:admin.common.role' },
      {
        field: 'status',
        label: '$t:admin.common.status',
        cellStyle: [
          {
            when: { eq: 'pending' },
            className: STATUS_BADGE.quiet.progress,
          },
          {
            when: { eq: 'expired' },
            className: STATUS_BADGE.loud,
          },
        ],
      },
      { field: 'invitedBy', label: '$t:admin.users.invite.by' },
      { field: 'expiresAt', label: '$t:admin.common.expires', format: 'datetime' },
      {
        type: 'actions',
        label: '$t:admin.common.actions',
        // Same gate as the directory's: the whole `/api/admin/invitations`
        // surface 404s an admin-tier-but-not-equivalent operator.
        capability: 'administer-accounts',
        actions: [
          {
            // No confirm: sending a second copy of an invitation the operator
            // already meant to send is not destructive, and a dialog here would
            // stand in front of the commonest recovery from "it never arrived".
            label: '$t:admin.users.invite.resend',
            action: {
              type: 'fetch',
              method: 'POST',
              url: '/api/admin/invitations/$record.id/resend',
              onSuccess: {
                type: 'toast',
                message: '$t:admin.users.invite.resent',
                refetch: INVITATIONS_GRID_ID,
              },
            },
          },
          {
            label: '$t:admin.common.revoke',
            // Gated, because revoking is irreversible in the sense that
            // matters: the link already in the invitee's inbox stops working,
            // and they will click it before anyone tells them not to. The
            // dialog says that rather than asking an abstract "are you sure?".
            //
            // The labels are deliberately DISJOINT from the row control's, so
            // the dialog's affordance can never be mistaken — by an operator or
            // by a test — for the button that opened it.
            confirm: {
              title: '$t:admin.users.invite.revokeConfirm',
              message: '$t:admin.users.invite.revokeMessage',
              role: 'alertdialog',
              confirmLabel: '$t:admin.common.confirm',
              cancelLabel: '$t:admin.common.cancel',
            },
            action: {
              type: 'fetch',
              method: 'DELETE',
              url: '/api/admin/invitations/$record.id',
              onSuccess: {
                type: 'toast',
                message: '$t:admin.users.invite.revoked',
                refetch: INVITATIONS_GRID_ID,
              },
            },
          },
        ],
      },
    ],
    emptyMessage: '$t:admin.users.invite.none',
  }) as PageComponent

/**
 * The two halves of this route, and the `?tab=` value that addresses each.
 *
 * Members first: the directory is what an operator opens Users to read, and the
 * invitation lifecycle is the thing they come back for.
 */
const TABS = [
  { id: 'members', label: '$t:admin.users.tab.members' },
  { id: 'invitations', label: '$t:admin.users.tab.invitations' },
] as const

/** The Members panel: the account figures, the directory, and the Invite gesture. */
const membersPanel = (): PageComponent =>
  tabPanel([
    toolbarRow([
      toolbarSearch(USERS_CHANNEL, '$t:admin.users.search'),
      exportAffordance(),
      inviteAffordance(),
    ]),
    accountFigures(),
    usersGrid(),
  ])

/** The Invitations panel: issue one, see what is outstanding, take one back. */
const invitationsPanel = (): PageComponent =>
  tabPanel([toolbarRow([inviteAffordance()]), invitationsGrid()], { scroll: true })

/**
 * Both routes render the SAME body; only the tab a bare URL opens on differs.
 *
 * Written as a factory rather than two literals so the two can never drift into
 * showing different tables under the same caption — which is the failure the
 * sibling pages made possible and nothing detected for as long as they existed.
 */
const usersPage = (config: {
  readonly id: string
  readonly path: string
  readonly title: string
  readonly defaultTab: string
  // The retained route keeps its OWN heading, not the parent's. The `h1` is
  // `sr-only`, so it is the ONLY thing that names the surface to a screen
  // reader — a reader landing on `/users/invitations` hearing "Users" would get
  // the parent's name for a page the breadcrumb calls Invitations.
  readonly heading: readonly [string, string]
  readonly breadcrumb: Readonly<Record<string, string>>
}): PageConfig =>
  consolePage({
    id: config.id,
    path: config.path,
    title: config.title,
    heading: config.heading,
    tabs: {
      label: '$t:admin.users.tabs.region',
      specs: TABS,
      panels: [membersPanel(), invitationsPanel()],
      defaultId: config.defaultTab,
      fill: true,
    },
    // The dialog renders in a portal, so where it sits in the tree changes
    // nothing on screen; after the strip, it is one dialog for both halves.
    body: [inviteDialog()],
    shell: { breadcrumb: config.breadcrumb, fill: true },
  })

/** `/users` — the account directory, with the invitation lifecycle beside it. */
const directoryPage: PageConfig = usersPage({
  id: 'dashboard-data-users',
  path: '/users',
  title: '$t:admin.meta.users',
  defaultTab: 'members',
  heading: ['$t:admin.users.heading', '$t:admin.users.blurb'],
  breadcrumb: { users: '$t:admin.crumb.users' },
})

/**
 * The directory and one account.
 *
 * `/users/invitations` is no page any more: it answers a permanent move to
 * `/users?tab=invitations` (`config/redirects.ts`), and a redirect is resolved
 * before any page, so the literal can never reach `/users/:email` as an account
 * called "invitations".
 */
export default [directoryPage, accountPage] satisfies readonly PageConfig[]
