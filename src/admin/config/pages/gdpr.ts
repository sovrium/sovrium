/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// My data (GDPR) — the DATA half of the operator's own account: what this
// instance holds about you, and how to take it out or erase it. The IDENTITY
// half (name / email / password / picture / language) is `profile.ts`.
//
// ─── IT IS THE SAME LIST AS `/profile`, AND THAT IS THE POINT ──────────────
//
// Four rows on the shared `settings-row` grid, under the same identity header.
// The two pages are one cluster split across two routes; a reader crossing
// between them should not have to re-learn where a control lives. What this
// replaces stacked a bordered section per control, and a second tinted one
// inside the page column for erasure.
//
// The tint went with them, deliberately. Erasure is the one irreversible thing
// here, and it says so on the CONTROL — a destructive button, then a
// type-to-confirm dialog — rather than by tinting a container. Colour is
// reserved for consequence ([internal ref] D3), and a filled panel spends it on a
// region that is mostly prose.
//
// ─── EVERY CONTROL IS GENERIC CONFIG; THE BESPOKE ISLAND IS GONE ───────────
//
//   EXPORT  → a `mode: download` button over `GET /api/account/export`, saving
//             `my-account.json` natively, with a persistent `onSuccess.status`.
//   ERASE   → a destructive button whose object `confirm` is a type-to-confirm
//             `alertdialog`: the affordance stays disabled until the operator
//             retypes their OWN email (`matchValue: '$session.email'`, resolved
//             client-side). On confirm it POSTs `{ confirm: true }`.
//   PENDING → a system-source `table` over `GET /api/account/pending-erasure`
//             with a per-row cancel that `refetch`es the grid back to empty.
//
// ─── WHY ERASE HAS NO `refetch` AND CANCEL DOES ────────────────────────────
//
// Scheduling an erasure REVOKES the session by design, so a refetch after it
// would be an unauthenticated read — the status line is the whole feedback, and
// that is deliberate rather than an omission. Cancelling revokes nothing, so its
// refetch-to-empty is valid and is what clears the row.
//
// ─── THE TWO CONFIRM DIALOGS CARRY DIFFERENT NAMES ON PURPOSE ──────────────
//
// The pending row's trigger is "Cancel"; its confirm dialog is titled "Confirm
// cancellation" and its affirm button repeats that title rather than saying
// "Cancel" — two buttons reading "Cancel" one dialog apart, meaning opposite
// things, is the ambiguity the longer label buys out of.

import { COLUMN, ROW_HINT, row, status } from '../components/settings-row'
import { withShell } from '../components/shell'
import type { Page as PageConfig } from '@/domain/models/app'
/**
 * The component union, derived rather than imported.
 *
 * `sovrium` exports `PageConfig` and NOT `PageComponent` — the ambient module
 * the binary writes carries the top-level config types only. `sidebar.ts`
 * derives it the same way; a direct import typechecks in an editor that
 * resolves the source tree and fails `bun run typecheck` against the shipped
 * declaration, which is exactly how this got in.
 */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** The pending-erasure grid id — the `onSuccess.refetch` target. */
const PENDING_GRID_ID = 'gdpr-pending-grid'

/**
 * A row whose action is a plain `button` rather than a form's submit.
 *
 * The forms on `/profile` make their own `control | action` pair with an
 * internal grid; a row built by hand has to make the same one, or its control
 * lands under a paragraph's width instead of on the column every other action
 * on both pages shares.
 */
const ACTION_PAIR =
  'grid grid-cols-1 items-start gap-x-6 gap-y-2 sm:grid-cols-[minmax(0,26rem)_max-content]'

/** Guidance on the left, one control on the right. */
const actionRow = (hint: string, control: PageComponent): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: ACTION_PAIR },
    children: [
      { type: 'text', element: 'p', props: { className: ROW_HINT }, content: hint },
      control,
    ],
  }) as PageComponent

export default withShell(
  {
    id: 'dashboard-gdpr',
    name: 'dashboard-gdpr',
    path: '/gdpr',
    meta: { title: '$t:admin.meta.gdpr', lang: 'en-US' },
    components: [
      {
        type: 'container',
        element: 'div',
        props: { className: COLUMN },
        children: [
          // The same identity header `/profile` opens with, for the same reason:
          // these controls act on ONE account, and the reader should be able to
          // see which one before they erase it.
          {
            type: 'container',
            element: 'div',
            props: {
              className: 'flex items-center gap-4 pt-7 pb-6',
              'aria-label': '$t:admin.profile.identity.region',
            },
            children: [
              {
                type: 'avatar',
                src: '$session.image',
                label: '$session.name',
                size: 'lg',
                props: { 'data-testid': 'gdpr-avatar', className: 'size-16 text-lg' },
              },
              {
                type: 'container',
                element: 'div',
                props: { className: 'flex min-w-0 flex-col gap-0.5' },
                children: [
                  {
                    type: 'text',
                    element: 'h1',
                    props: { className: 'text-3xl font-semibold tracking-tight' },
                    session: 'name',
                  },
                  {
                    type: 'text',
                    element: 'p',
                    props: {
                      className: 'text-foreground-subtle text-md',
                      'data-testid': 'gdpr-identity-email',
                    },
                    session: 'email',
                  },
                ],
              },
            ],
          },
          {
            type: 'container',
            element: 'section',
            props: {
              className: 'border-border flex flex-col border-t',
              'aria-label': '$t:admin.gdpr.heading',
            },
            children: [
              // ── Export ───────────────────────────────────────────────────
              row('$t:admin.gdpr.export.heading', [
                actionRow('$t:admin.locked.audit.gdpr.exportScope', {
                  type: 'button',
                  variant: 'secondary',
                  content: '$t:admin.gdpr.export.submit',
                  props: { id: 'gdpr-export-btn', className: 'w-fit' },
                  action: {
                    type: 'fetch',
                    mode: 'download',
                    url: '/api/account/export',
                    filename: 'my-account.json',
                    onSuccess: {
                      type: 'toast',
                      variant: 'success',
                      message: 'Export complete',
                      status: { target: 'gdpr-export-status', message: 'Export generated' },
                    },
                  },
                } as PageComponent),
                status('gdpr-export-status'),
              ]),
              // ── Erase ────────────────────────────────────────────────────
              //
              // The grace / irreversibility callout (S5) is this row's guidance.
              // The dialog states it again on the way through, because the two
              // are read at different moments by different people.
              row('$t:admin.gdpr.erase.heading', [
                actionRow('$t:admin.locked.audit.gdpr.erasureNotice', {
                  type: 'button',
                  // Erasure is the one destructive control on this page, so it
                  // names the destructive tone rather than hand-painting an
                  // error fill — which is how it also gains the hover step the
                  // recipe carries and a hand-written pair does not.
                  variant: 'destructive',
                  content: '$t:admin.gdpr.erase.submit',
                  props: { id: 'gdpr-erase-btn', className: 'w-fit' },
                  // Every string in the gate is a key, including the ones that
                  // read as chrome. This dialog is where the irreversibility is
                  // stated at the moment it is being decided, so an
                  // English-only dialog in front of a French console states it
                  // to nobody — and the row hint above, which IS translated,
                  // would be left carrying the whole warning on its own.
                  confirm: {
                    title: '$t:admin.gdpr.erase.confirm.title',
                    message: '$t:admin.gdpr.erase.confirm.message',
                    role: 'alertdialog',
                    input: {
                      label: '$t:admin.gdpr.erase.confirm.input',
                      matchValue: '$session.email',
                    },
                    confirmLabel: '$t:admin.gdpr.erase.confirm.affirm',
                    cancelLabel: '$t:admin.gdpr.erase.confirm.dismiss',
                  },
                  action: {
                    type: 'fetch',
                    url: '/api/account/delete',
                    method: 'POST',
                    body: { confirm: true },
                    onSuccess: {
                      type: 'toast',
                      variant: 'success',
                      message: 'Deletion scheduled',
                      status: { target: 'gdpr-erase-status', message: 'Deletion scheduled' },
                    },
                  },
                } as PageComponent),
                status('gdpr-erase-status'),
              ]),
              // ── In progress ──────────────────────────────────────────────
              //
              // The one row whose body is NOT a control pair: the grid spans the
              // body column in full, because a table squeezed into a 416px
              // measure beside an empty action cell reads as a mistake.
              row('$t:admin.gdpr.pending.region', [
                {
                  type: 'table',
                  props: { id: PENDING_GRID_ID, 'aria-label': '$t:admin.gdpr.pending.region' },
                  dataSource: {
                    system: {
                      endpoint: '/api/account/pending-erasure',
                      rowsKey: 'items',
                      idKey: 'id',
                    },
                  },
                  columns: [
                    { field: 'email', label: '$t:admin.gdpr.pending.account' },
                    {
                      field: 'scheduledErasureAt',
                      label: '$t:admin.gdpr.pending.due',
                      format: 'relative-time',
                    },
                    {
                      type: 'actions',
                      label: '$t:admin.gdpr.pending.actions',
                      actions: [
                        {
                          label: '$t:admin.gdpr.pending.cancel',
                          confirm: {
                            title: '$t:admin.gdpr.pending.confirm.title',
                            message: '$t:admin.gdpr.pending.confirm.message',
                            role: 'alertdialog',
                            confirmLabel: '$t:admin.gdpr.pending.confirm.affirm',
                            cancelLabel: '$t:admin.gdpr.pending.confirm.dismiss',
                          },
                          action: {
                            type: 'fetch',
                            url: '/api/account/delete',
                            method: 'POST',
                            body: { cancel: true },
                            onSuccess: {
                              type: 'toast',
                              message: 'Request cancelled',
                              refetch: PENDING_GRID_ID,
                            },
                          },
                        },
                      ],
                    },
                  ],
                  emptyMessage: '$t:admin.gdpr.pending.empty',
                } as PageComponent,
              ]),
              // ── Your account ─────────────────────────────────────────────
              row('$t:admin.gdpr.account.label', [
                actionRow('$t:admin.gdpr.account.hint', {
                  type: 'link',
                  content: '$t:admin.gdpr.profileLink',
                  props: {
                    href: '/profile',
                    className:
                      'border-border-strong bg-background-raised text-foreground hover:bg-background-subtle inline-flex h-8 w-fit items-center rounded-[var(--radius-base,4px)] border px-3 text-base font-medium',
                    'data-testid': 'gdpr-profile-link',
                  },
                } as PageComponent),
              ]),
            ],
          },
        ],
      },
    ],
  } as PageConfig,
  { breadcrumb: { gdpr: '$t:admin.crumb.gdpr' } }
) satisfies PageConfig
