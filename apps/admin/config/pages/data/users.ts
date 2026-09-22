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
//   `/users`              every account this app has, with the three account
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

import { pageHeading, tabQuery, tabbedBody, tabPanel, toolbarRow } from '../../components/dataPage'
import { withShell } from '../../components/shell'
import { ADMIN_ROLES_ENDPOINT, USERS_ENDPOINT, USERS_OVERVIEW_ENDPOINT } from '../../systemSources'
import type { PageConfig } from 'sovrium'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** Id of the directory grid — the `onSuccess.refetch` target of all three writes. */
const USERS_GRID_ID = 'admin-users-grid'

/** Id of the pending-invitations grid — its own `onSuccess.refetch` target. */
const INVITATIONS_GRID_ID = 'admin-invitations-grid'

/**
 * The role picker's option source, shared by the directory's inline editor and
 * the invite form.
 *
 * `valueKey: 'name'` because a role name IS its identity — the endpoint's rows
 * are `{ name }` and no write endpoint accepts anything else. `labelKey` is the
 * same key: there is no separate display name for a role, and inventing one
 * would put a label in the picker that the operator cannot find in their config.
 */
const ROLE_OPTIONS_SOURCE = {
  system: { endpoint: ADMIN_ROLES_ENDPOINT, rowsKey: 'roles' },
  valueKey: 'name',
  labelKey: 'name',
} as const

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
  { field: 'email', label: 'Email' },
  { field: 'name', label: 'Name' },
  { field: 'role', label: 'Role' },
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
    label: 'Account',
    // `mode: 'navigate'` on a FETCH action: a top-level `type: 'navigate'` is
    // INERT on a button, because the dispatcher emits data attributes for
    // `automation` / `auth` / `crud` / `fetch` only. Same lever the Invite
    // affordance below uses, and for the same reason.
    actions: [
      {
        label: 'Open',
        action: { type: 'fetch', mode: 'navigate', url: '/users/$record.email' },
      },
    ],
  },
  {
    type: 'actions',
    label: 'Actions',
    // The whole column, or nothing. Gating the three items individually would
    // leave a labelled "Actions" header over three empty cells — a column
    // announcing a power the caller does not have, which is the greyed-out
    // button in another spelling. Exclusion is also what keeps the three
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
    // column so the three reversible gestures beside it keep receding.
    //
    // `Lift ban` deliberately says nothing. It is the REVERSAL, and reddening
    // it would paint the recovery in the colour of the harm.
    actions: [
      {
        label: 'Change role',
        editSelect: {
          field: 'role',
          label: 'Role',
          saveLabel: 'Save',
          optionsSource: ROLE_OPTIONS_SOURCE,
        },
        action: {
          type: 'fetch',
          url: '/api/auth/admin/set-role',
          method: 'POST',
          // `$record.role` resolves to the PICKED value: an `editSelect`
          // overrides its field in the dispatched action's record context.
          body: { userId: '$record.id', role: '$record.role' },
          // The Better-Auth admin plugin answers 200 on failure too (an
          // enumeration-safe envelope), so success is read from the body.
          responseEnvelope: 'better-auth',
          onSuccess: { type: 'toast', message: 'Role updated', refetch: USERS_GRID_ID },
        },
      },
      {
        label: 'Ban',
        variant: 'destructive',
        visibleWhen: { field: 'banned', eq: false },
        confirm: {
          title: 'Confirm ban',
          message: 'This account loses access immediately. You can lift the ban later.',
          role: 'alertdialog',
          // Both labels EXPLICIT: the confirm-gate runtime defaults its buttons
          // to French, which would drop two French words into an otherwise
          // English console.
          confirmLabel: 'Confirm ban',
          cancelLabel: 'Cancel',
        },
        action: {
          type: 'fetch',
          url: '/api/auth/admin/ban-user',
          method: 'POST',
          body: { userId: '$record.id' },
          responseEnvelope: 'better-auth',
          onSuccess: { type: 'toast', message: 'Account banned', refetch: USERS_GRID_ID },
        },
      },
      {
        // No confirm: lifting a ban is the reversal of a reversible action.
        // Confirmation is reserved for the direction that removes access.
        label: 'Lift ban',
        visibleWhen: { field: 'banned', eq: true },
        action: {
          type: 'fetch',
          url: '/api/auth/admin/unban-user',
          method: 'POST',
          body: { userId: '$record.id' },
          responseEnvelope: 'better-auth',
          onSuccess: { type: 'toast', message: 'Ban lifted', refetch: USERS_GRID_ID },
        },
      },
    ],
  },
] as const

/**
 * The entry point to the invitation lifecycle.
 *
 * A BUTTON that navigates rather than a link, because it is a directory-level
 * gesture in the same family as the row controls beside it, and because the
 * invitation surface is a working area rather than a document to browse to.
 *
 * `mode: 'navigate'` on a `fetch` action is the dispatch the shared action
 * executor implements as `location.assign`, and the same one the CSV export
 * uses. A top-level `type: 'navigate'` action reads better and is INERT on a
 * standalone button: the button builders emit data attributes for
 * `automation` / `auth` / `crud` / `fetch` only, so it would render a control
 * that does nothing.
 *
 * The url is MOUNT-RELATIVE like every other console path — the boot walk moves
 * it onto whichever base is serving the console.
 */
const inviteAffordance = (): PageComponent =>
  ({
    type: 'button',
    label: 'Invite',
    variant: 'secondary',
    visibility: { capability: 'administer-accounts' },
    // `?tab=invitations` rather than `/users/invitations`: the same destination
    // either way, but this one keeps the operator on the route they are already
    // reading and opens the half that holds the form. The sibling route stays
    // reachable for the bookmarks that name it; nothing inside the console
    // needs to send anyone there any more.
    action: { type: 'fetch', mode: 'navigate', url: '/users?tab=invitations' },
    props: { className: 'self-start' },
  }) as PageComponent

/**
 * One account figure, read as a pre-computed scalar from the users-overview
 * envelope. A failed read degrades to the neutral em-dash placeholder rather
 * than to a zero, which would be a wrong answer rather than an absent one.
 */
const overviewKpi = (label: string, valuePath: string): PageComponent =>
  ({
    type: 'kpi',
    label,
    dataSource: { system: { endpoint: USERS_OVERVIEW_ENDPOINT, valuePath } },
    kpiFormat: { type: 'number' },
  }) as PageComponent

/**
 * The KPI strip: a named region over the three account figures.
 *
 * All three read the SAME endpoint and the same (absent) query, so the
 * system-value hook collapses them into ONE request — it keys its cache on the
 * endpoint and query and deliberately NOT on the per-tile value path.
 */
const kpiStrip = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      role: 'region',
      'aria-label': '$t:admin.users.metrics.region',
      className: 'grid grid-cols-1 gap-4 sm:grid-cols-3',
    },
    children: [
      overviewKpi('Accounts', 'totals.users'),
      overviewKpi('Active (24h)', 'totals.active_24h'),
      overviewKpi('New (period)', 'totals.new_in_period'),
    ],
  }) as PageComponent

/**
 * The directory grid.
 *
 * `totalKey` is load-bearing: without it the grid counts the rows it was
 * handed, so a page of 25 out of 33 accounts reported "1–25 of 25" with Next
 * disabled over the eight it was hiding. The endpoint reports how many accounts
 * MATCH; the pager needs that number, not this page's length.
 *
 * Search goes to the SERVER — the grid forwards its box as `?q=` over email and
 * name, and the response's `appliedQuery` is what tells it the narrowing
 * already ran so it must not repeat it in memory over the page it holds.
 *
 * `toolbar.export` paints the CSV affordance, a `mode: navigate` to this same
 * endpoint's `?format=csv`.
 */
const usersGrid = (): PageComponent =>
  ({
    type: 'table',
    props: { id: USERS_GRID_ID, 'aria-label': '$t:admin.users.region' },
    dataSource: {
      system: { endpoint: USERS_ENDPOINT, rowsKey: 'users', idKey: 'id', totalKey: 'total' },
    },
    columns: USERS_COLUMNS,
    search: { enabled: true, placeholder: 'Search users' },
    toolbar: { search: true, export: true, sort: true },
    pagination: { pageSize: 25 },
    // The grid owns the scroll: the invite row and the KPI strip above it keep
    // their natural height, the rows take the rest, and the pager stays on
    // screen instead of sitting below twenty-five rows of directory.
    layout: 'fill',
    emptyMessage: 'No users yet',
    noMatchMessage: 'No user matches “{query}”',
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
    props: { 'aria-label': '$t:admin.invitations.form.region' },
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
      onError: { type: 'toast', variant: 'destructive', message: 'Could not send the invitation' },
    },
    fields: [
      { field: 'email', control: 'email', label: 'Email address' },
      { field: 'name', control: 'text', label: 'Full name (optional)' },
      // The picker IS the write boundary: `validateInviteInput` accepts exactly
      // this set and enumerates it back in its own 400.
      { field: 'role', control: 'select', label: 'Role', optionsSource: ROLE_OPTIONS_SOURCE },
    ],
  }) as PageComponent

/** The invite form under a labelled heading, so the page reads as two sections. */
const inviteSection = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: {
      'aria-label': '$t:admin.invitations.form.region',
      className: 'border-border flex flex-col gap-3 rounded-lg border p-4',
    },
    children: [
      {
        type: 'text',
        element: 'h2',
        props: { className: 'text-xl font-semibold' },
        content: '$t:admin.invitations.form.region',
      },
      inviteForm(),
    ],
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
  ({
    type: 'table',
    props: { id: INVITATIONS_GRID_ID, 'aria-label': '$t:admin.invitations.pending.region' },
    dataSource: {
      system: { endpoint: '/api/admin/invitations', rowsKey: 'items', idKey: 'id' },
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
            className: 'bg-success-bg text-success-fg rounded-full px-2 py-0.5 text-sm',
          },
          {
            when: { eq: 'expired' },
            className: 'bg-error-bg text-error-fg rounded-full px-2 py-0.5 text-sm',
          },
        ],
      },
      { field: 'invitedBy', label: 'Invited by' },
      { field: 'expiresAt', label: 'Expires' },
      {
        type: 'actions',
        label: 'Actions',
        // Same gate as the directory's: the whole `/api/admin/invitations`
        // surface 404s an admin-tier-but-not-equivalent operator.
        capability: 'administer-accounts',
        actions: [
          {
            // No confirm: sending a second copy of an invitation the operator
            // already meant to send is not destructive, and a dialog here would
            // stand in front of the commonest recovery from "it never arrived".
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
          },
          {
            label: 'Revoke',
            // Gated, because revoking is irreversible in the sense that
            // matters: the link already in the invitee's inbox stops working,
            // and they will click it before anyone tells them not to. The
            // dialog says that rather than asking an abstract "are you sure?".
            //
            // The labels are deliberately DISJOINT from the row control's, so
            // the dialog's affordance can never be mistaken — by an operator or
            // by a test — for the button that opened it.
            confirm: {
              title: 'Revoke this invitation?',
              message:
                'The link already sent stops working immediately. You can invite this person again afterwards.',
              role: 'alertdialog',
              confirmLabel: 'Confirm',
              cancelLabel: 'Cancel',
            },
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
          },
        ],
      },
    ],
    emptyMessage: 'No invitations outstanding',
  }) as PageComponent

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
// Teams are `auth.groups[]`, and no admin read publishes an account's
// membership. Last activity needs the session table joined into the directory
// (`?include=lastActiveAt`, absent). Both are worded gaps with NO figure, never
// a tile reading zero — the footprint page's instrument rule.

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
        // these five lives on `/api/auth/admin/*`, which 404s an admin-tier but
        // not admin-EQUIVALENT operator.
        capability: 'administer-accounts',
        // TWO items here name the danger weight where the directory names one:
        // this column also carries Delete account, which is the only gesture in
        // the console that removes the row rather than changing it. `End all
        // sessions` stays neutral on its own comment's reasoning — the person
        // signs in again — and `Lift ban` stays neutral because it is a repair.
        actions: [
          {
            label: 'Change role',
            editSelect: {
              field: 'role',
              label: 'Role',
              saveLabel: 'Save',
              optionsSource: ROLE_OPTIONS_SOURCE,
            },
            action: {
              type: 'fetch',
              url: '/api/auth/admin/set-role',
              method: 'POST',
              body: { userId: '$record.id', role: '$record.role' },
              responseEnvelope: 'better-auth',
              onSuccess: { type: 'toast', message: 'Role updated', refetch: ACCOUNT_GRID_ID },
            },
          },
          {
            label: 'Ban',
            variant: 'destructive',
            visibleWhen: { field: 'banned', eq: false },
            confirm: {
              title: 'Confirm ban',
              message: 'This account loses access immediately. You can lift the ban later.',
              role: 'alertdialog',
              confirmLabel: 'Confirm ban',
              cancelLabel: 'Cancel',
            },
            action: {
              type: 'fetch',
              url: '/api/auth/admin/ban-user',
              method: 'POST',
              body: { userId: '$record.id' },
              responseEnvelope: 'better-auth',
              onSuccess: { type: 'toast', message: 'Account banned', refetch: ACCOUNT_GRID_ID },
            },
          },
          {
            label: 'Lift ban',
            visibleWhen: { field: 'banned', eq: true },
            action: {
              type: 'fetch',
              url: '/api/auth/admin/unban-user',
              method: 'POST',
              body: { userId: '$record.id' },
              responseEnvelope: 'better-auth',
              onSuccess: { type: 'toast', message: 'Ban lifted', refetch: ACCOUNT_GRID_ID },
            },
          },
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

/** The three gaps, side by side, under one heading. */
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
        props: { className: 'grid grid-cols-1 gap-4 lg:grid-cols-3' },
        children: [
          gapCard(
            '$t:admin.users.account.gaps.sessions.heading',
            '$t:admin.users.account.gaps.sessions.body'
          ),
          gapCard(
            '$t:admin.users.account.gaps.teams.heading',
            '$t:admin.users.account.gaps.teams.body'
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
const accountPage: PageConfig = withShell(
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

/**
 * The two halves of this route, and the `?tab=` value that addresses each.
 *
 * Members first: the directory is what an operator opens Users to read, and the
 * invitation lifecycle is the thing they come back for.
 */
const TABS = [
  { id: 'members', label: 'Members' },
  { id: 'invitations', label: 'Invitations' },
] as const

/** The Members panel: the account figures, the directory, and the Invite gesture. */
const membersPanel = (): PageComponent =>
  tabPanel([toolbarRow([inviteAffordance()]), kpiStrip(), usersGrid()])

/** The Invitations panel: issue one, see what is outstanding, take one back. */
const invitationsPanel = (): PageComponent =>
  tabPanel([inviteSection(), invitationsGrid()], { scroll: true })

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
  withShell(
    {
      id: config.id,
      name: config.id,
      path: config.path,
      meta: { title: config.title, lang: 'en-US' },
      query: tabQuery(TABS, config.defaultTab),
      components: [
        pageHeading(config.heading[0], config.heading[1]),
        tabbedBody('$t:admin.users.tabs.region', TABS, [membersPanel(), invitationsPanel()], {
          fill: true,
        }),
      ],
    } as PageConfig,
    { breadcrumb: config.breadcrumb, fill: true }
  )

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
 * `/users/invitations` — the retained address, opening on the Invitations tab.
 *
 * The same strip as `/users`, with the other half selected. It keeps its own
 * document title and its two-segment breadcrumb, so a bookmark still says what
 * it is looking at; what it no longer is, is a second body that could disagree
 * with the one above.
 */
const invitationsPage: PageConfig = usersPage({
  id: 'dashboard-data-invitations',
  path: '/users/invitations',
  title: '$t:admin.meta.invitations',
  defaultTab: 'invitations',
  heading: ['$t:admin.invitations.heading', '$t:admin.invitations.blurb'],
  breadcrumb: { users: '$t:admin.crumb.users', invitations: '$t:admin.crumb.invitations' },
})

/**
 * Three pages, and the ORDER IS NOW LOAD-BEARING.
 *
 * It was free while the two patterns were disjoint. `/users/:email` ends that:
 * `findMatchingRoute` takes the FIRST pattern that matches and has no
 * static-over-dynamic precedence, so `/users/invitations` listed after it would
 * be swallowed — the param page would render for the literal address, with
 * `email = 'invitations'` and an empty grid. The literal sub-path comes first,
 * and any future one goes with it.
 */
export default [directoryPage, invitationsPage, accountPage] satisfies readonly PageConfig[]
