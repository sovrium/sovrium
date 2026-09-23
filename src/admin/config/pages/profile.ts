/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// My profile — the IDENTITY half of the operator's own account.
//
// The DATA half (export, erasure) is `gdpr.ts`, and each page cross-links the
// other: the split is only an improvement while both halves stay findable.
//
// ─── ONE SETTINGS LIST, NOT SIX CARDS ──────────────────────────────────────
//
// Every property is a ROW on one hairline-separated grid: `label | control |
// action`. The previous shape gave each property its own bordered card, and the
// engine's form recipe drew a SECOND bordered card inside it — two frames
// painting the identical `oklch(0.995 0 0)`, so the inner one carried no
// information and, at 375px, cost 38px of gutter on each side. A settings list
// is a list; the rule between rows is the only separator it spends.
//
// The frame is declined in CONFIG, not by a new schema key: the form renderer
// merges `props.className` over its recipe through `resolveClasses`, so
// `border-0 bg-transparent p-0 rounded-none` on the form drops the card and
// `grid sm:grid-cols-[minmax(0,26rem)_auto]` re-lays the submit into its own
// right-hand column at its natural width — where the recipe's `w-full` column
// had stretched it to 692px.
//
// ─── THREE BETTER-AUTH FORMS PLUS THE LANGUAGE, NO ISLAND ──────────────────
//
// | Row       | Endpoint                         | Note                        |
// |-----------|----------------------------------|-----------------------------|
// | Name      | `POST /api/auth/update-user`     | Better Auth catch-all       |
// | Email     | `POST /api/auth/change-email`    | `changeEmail.enabled: true` |
// | Password  | `POST /api/auth/change-password` | in the OpenAPI catalogue    |
// | Language  | `POST /api/auth/update-user`     | clamped to `languages`      |
//
// `responseEnvelope: 'better-auth'` on all four: these are Better-Auth routes,
// which answer with their own envelope rather than Sovrium's `{ success }`.
//
// Each control arrives carrying what it is about to change — `defaultValue:
// '$session.name'` / `'$session.email'` / `'$session.language'`, resolved
// CLIENT-side from `GET /api/auth/get-session`. The served bytes name nobody, so
// a cached copy of this page cannot carry one reader's identity to the next.
//
// ─── TWO HONEST LIMITS, STATED RATHER THAN DESIGNED AROUND ─────────────────
//
// 1. An email change does NOT take effect on submit. Better Auth is configured
//    with `changeEmail: { enabled: true, sendChangeEmailVerification: … }`, so
//    the address does not move until the link is followed — measured live,
//    `POST /api/auth/change-email` answers `200 {"status":true}` while
//    `auth_user.email` is unchanged. A form reporting success over a value that
//    did not change reads as broken, so both the hint and the success status
//    name the pending step. Caveat: the verification mailer swallows send
//    failures by design, so on a host with no SMTP this still says "Verification
//    link sent" and none is. That is pre-existing and shared with password reset.
// 2. Saving a language takes effect on the spot, and it costs a reload to do
//    it. The server composes the console in the signed-in operator's language,
//    so the choice is real from the next request onward and invisible until
//    one happens. `onSuccess.reload: true` makes that request immediately; the
//    same document comes back in the new language, sidebar and breadcrumb
//    included, which `refetch` could never do because it skips any region
//    holding a mounted island. The trade is priced by the schema, which refuses
//    `reload` beside `status`: the confirmation cannot outlive the document, so
//    the switch itself is the confirmation.
//
// ─── ONE VOCABULARY FOR THE SUBMITS ────────────────────────────────────────
//
// Each row's `endpoint` names `submitVariant: 'secondary'`. A settings list has
// one action per row and no primary among them, and this is the button schema's
// own member list saying so — not a scoped `[&>button[type=submit]]:` repaint
// painted from outside the component, which is what stood here until the key
// existed. `/gdpr` needed no such change: its actions are plain `button`s that
// have always named their own `variant`, `destructive` on erasure included.

import {
  COLUMN,
  ROW_FORM_ONE,
  ROW_FORM_PAIR,
  ROW_HINT,
  row,
  status,
} from '../components/settings-row'
import { withShell } from '../components/shell'
import type { Page as PageConfig } from '@/domain/models/app'

export default withShell(
  {
    id: 'dashboard-profile',
    name: 'dashboard-profile',
    path: '/profile',
    meta: { title: '$t:admin.meta.profile', lang: 'en-US' },
    components: [
      {
        type: 'container',
        element: 'div',
        props: { className: COLUMN },
        children: [
          // ── Identity header ────────────────────────────────────────────────
          //
          // The ONE place on this page the account is DISPLAYED rather than
          // edited, and so the only element allowed any weight. Every value is a
          // session binding: the server draws the absence branch, the client
          // fills it, and nothing here is in the served bytes.
          //
          // The avatar's chain is ordered and that is the feature — a picture if
          // the account has one, the operator's own initials from `$session.name`
          // if it does not. An operator who never uploaded one gets a readable
          // disc rather than a broken image.
          {
            type: 'container',
            element: 'div',
            props: {
              id: 'profile-identity',
              className: 'flex items-center gap-4 pt-7 pb-6',
              'aria-label': '$t:admin.profile.identity.region',
            },
            children: [
              {
                type: 'avatar',
                src: '$session.image',
                label: '$session.name',
                size: 'lg',
                props: { 'data-testid': 'profile-avatar', className: 'size-16 text-lg' },
              },
              {
                type: 'container',
                element: 'div',
                props: { className: 'flex min-w-0 flex-col gap-0.5' },
                children: [
                  {
                    type: 'container',
                    element: 'div',
                    props: { className: 'flex items-center gap-2.5' },
                    children: [
                      {
                        type: 'text',
                        element: 'h1',
                        props: { className: 'text-3xl font-semibold tracking-tight' },
                        session: 'name',
                      },
                      {
                        type: 'text',
                        element: 'span',
                        props: {
                          className:
                            'border-border bg-background-subtle text-foreground-subtle inline-flex w-fit rounded-full border px-2 py-0.5 text-xs font-medium capitalize',
                          'data-testid': 'profile-identity-role',
                        },
                        session: 'role',
                      },
                    ],
                  },
                  {
                    type: 'text',
                    element: 'p',
                    props: {
                      className: 'text-foreground-subtle text-md',
                      'data-testid': 'profile-identity-email',
                    },
                    session: 'email',
                  },
                ],
              },
            ],
          },
          // ── The settings list ──────────────────────────────────────────────
          {
            type: 'container',
            element: 'section',
            props: {
              id: 'profile-rows',
              className: 'border-border flex flex-col border-t',
              'aria-label': '$t:admin.profile.rows.region',
            },
            children: [
              // ── Picture ──────────────────────────────────────────────────
              //
              // No bucket is declared and none is needed: `POST /api/account/
              // avatar` stores the file in an engine-owned location, readable by
              // the signed-in operator and 404 to anyone else. An embedded
              // console cannot assume its host declared an `avatars` bucket, so
              // it must not need one.
              row('$t:admin.profile.picture.label', [
                {
                  type: 'container',
                  element: 'div',
                  // The picture row has no form, so it makes the two-column shape
                  // by hand: guidance where the controls of the rows below sit,
                  // its two actions where their submits sit.
                  props: {
                    className:
                      'grid grid-cols-1 items-start gap-x-6 gap-y-2 sm:grid-cols-[minmax(0,26rem)_max-content]',
                  },
                  children: [
                    {
                      type: 'text',
                      element: 'p',
                      props: { className: ROW_HINT },
                      content: '$t:admin.profile.picture.hint',
                    },
                    {
                      type: 'container',
                      element: 'div',
                      props: { className: 'flex items-start gap-2' },
                      children: [
                        {
                          type: 'file-upload',
                          // These key spellings are load-bearing: `dropZone` (capital
                          // Z), `maxFileSize` (bytes, not `maxSize`). An unrecognised
                          // key on this component is dropped in silence.
                          accept: 'image/png,image/jpeg,image/webp',
                          dropZone: false,
                          maxFileSize: 5_242_880,
                          uploadAction: '/api/account/avatar',
                          onSuccess: {
                            type: 'toast',
                            variant: 'success',
                            message: '$t:admin.profile.picture.uploaded',
                            status: {
                              target: 'profile-picture-status',
                              message: '$t:admin.profile.picture.uploaded',
                            },
                            // Redraw the header, or the picture the operator just
                            // chose stays invisible until they navigate. `refetch` on a
                            // SERVER-RENDERED region re-renders the page and swaps that
                            // subtree, re-applying the session fill with it — which is
                            // what puts the new image in the disc. It names the header
                            // and not the whole list because a region holding a mounted
                            // island is skipped, and the upload control is one.
                            refetch: 'profile-identity',
                          },
                          onError: {
                            type: 'toast',
                            variant: 'destructive',
                            message: '$t:admin.profile.picture.uploadFailed',
                          },
                          props: {
                            'data-testid': 'profile-picture-upload',
                            // A `file-upload`'s `label` resolves a `$t:` key now,
                            // so the trigger is no longer the one English word on
                            // a French page. The key it names was already in both
                            // catalogues, authored and unreachable.
                            label: '$t:admin.profile.picture.upload',
                            // Two shape corrections on the island from outside it.
                            // `w-fit` because its root is a `flex flex-col`, which
                            // stretches the trigger to the row; `sr-only` on the raw
                            // `<input type=file>` because the island renders BOTH a
                            // styled trigger and the native control, and the second
                            // one is an unstyled duplicate of the first. It stays in
                            // the accessibility tree and stays settable by
                            // `setInputFiles` — both verified live.
                            className: 'w-fit [&_input[type=file]]:sr-only',
                          },
                        },
                        {
                          type: 'button',
                          variant: 'ghost',
                          content: '$t:admin.profile.picture.remove',
                          props: { 'data-testid': 'profile-picture-remove', className: 'w-fit' },
                          // Removing a picture is small and reversible, so the
                          // question is a plain one — no type-to-confirm. It is asked
                          // at all because the control sits one tab stop from
                          // "Change" and names no target of its own.
                          confirm: {
                            title: '$t:admin.profile.picture.removeConfirm.title',
                            message: '$t:admin.profile.picture.removeConfirm.message',
                            confirmLabel: '$t:admin.profile.picture.removeConfirm.confirm',
                            cancelLabel: '$t:admin.profile.picture.removeConfirm.cancel',
                          },
                          action: {
                            type: 'fetch',
                            url: '/api/account/avatar',
                            method: 'DELETE',
                            onSuccess: {
                              type: 'toast',
                              variant: 'success',
                              message: '$t:admin.profile.picture.removed',
                              status: {
                                target: 'profile-picture-status',
                                message: '$t:admin.profile.picture.removed',
                              },
                              // Redraw the header, as the upload above does.
                              refetch: 'profile-identity',
                            },
                            onError: {
                              type: 'toast',
                              variant: 'destructive',
                              message: '$t:admin.profile.picture.removeFailed',
                            },
                          },
                        },
                      ],
                    },
                  ],
                },
                status('profile-picture-status'),
              ]),
              // ── Display name ─────────────────────────────────────────────
              row('$t:admin.field.displayName', [
                {
                  type: 'form',
                  props: {
                    className: ROW_FORM_ONE,
                    'aria-label': '$t:admin.profile.displayName.formRegion',
                  },
                  endpoint: {
                    url: '/api/auth/update-user',
                    method: 'POST',
                    responseEnvelope: 'better-auth',
                    submitLabel: '$t:admin.profile.displayName.submit',
                    submitVariant: 'secondary',
                    onSuccess: {
                      type: 'toast',
                      variant: 'success',
                      message: '$t:admin.profile.displayName.saved',
                      status: {
                        target: 'profile-name-status',
                        message: '$t:admin.profile.displayName.saved',
                      },
                    },
                    onError: {
                      type: 'toast',
                      variant: 'destructive',
                      message: '$t:admin.profile.displayName.failed',
                    },
                  },
                  fields: [
                    {
                      field: 'name',
                      control: 'text',
                      label: '$t:admin.field.displayName',
                      defaultValue: '$session.name',
                      description: '$t:admin.profile.displayName.hint',
                    },
                  ],
                },
                status('profile-name-status'),
              ]),
              // ── Email address ────────────────────────────────────────────
              row('$t:admin.field.email', [
                {
                  type: 'form',
                  props: {
                    className: ROW_FORM_ONE,
                    'aria-label': '$t:admin.profile.email.formRegion',
                  },
                  endpoint: {
                    url: '/api/auth/change-email',
                    method: 'POST',
                    responseEnvelope: 'better-auth',
                    submitLabel: '$t:admin.profile.email.submit',
                    submitVariant: 'secondary',
                    onSuccess: {
                      type: 'toast',
                      variant: 'success',
                      message: '$t:admin.profile.email.sent',
                      status: {
                        target: 'profile-email-status',
                        message: '$t:admin.profile.email.sentDetail',
                      },
                    },
                    onError: {
                      type: 'toast',
                      variant: 'destructive',
                      message: '$t:admin.profile.email.failed',
                    },
                  },
                  // `newEmail` is Better Auth's own body key, not a Sovrium choice.
                  fields: [
                    {
                      field: 'newEmail',
                      control: 'email',
                      label: '$t:admin.field.newEmail',
                      defaultValue: '$session.email',
                      description: '$t:admin.profile.email.hint',
                    },
                  ],
                },
                status('profile-email-status'),
              ]),
              // ── Password ─────────────────────────────────────────────────
              row('$t:admin.field.password', [
                {
                  type: 'form',
                  props: {
                    className: ROW_FORM_PAIR,
                    'aria-label': '$t:admin.profile.password.formRegion',
                  },
                  // `revokeOtherSessions` is deliberately NOT sent: silently
                  // signing every other device out is a consequential side
                  // effect, and this surface has no control offering it as a
                  // choice. Leaving it unset keeps the default rather than
                  // deciding for the operator in silence.
                  endpoint: {
                    url: '/api/auth/change-password',
                    method: 'POST',
                    responseEnvelope: 'better-auth',
                    submitLabel: '$t:admin.profile.password.submit',
                    submitVariant: 'secondary',
                    onSuccess: {
                      type: 'toast',
                      variant: 'success',
                      message: '$t:admin.profile.password.saved',
                      status: {
                        target: 'profile-password-status',
                        message: '$t:admin.profile.password.saved',
                      },
                    },
                    onError: {
                      type: 'toast',
                      variant: 'destructive',
                      message: '$t:admin.profile.password.failed',
                    },
                  },
                  fields: [
                    {
                      field: 'currentPassword',
                      control: 'password',
                      label: '$t:admin.field.currentPassword',
                    },
                    {
                      field: 'newPassword',
                      control: 'password',
                      label: '$t:admin.field.newPassword',
                    },
                  ],
                },
                status('profile-password-status'),
              ]),
              // ── Language ─────────────────────────────────────────────────
              //
              // The one setting here that changes nothing about the account: it
              // decides what the console SAYS. It is a per-ACCOUNT choice the
              // SERVER keeps — it outranks the `sovrium_language` cookie, so it
              // follows the operator to a browser they have never used, which is
              // what the per-browser switcher in the sidebar could never do (and
              // which was `md:max-xl:hidden` besides, so between 768 and 1279 the
              // setting was reachable nowhere at all).
              //
              // The option VALUES are locales, not codes: `/api/auth/update-user`
              // accepts either, and a locale is what `$session.language` reads
              // back, so the select re-opens on the value it last saved.
              row('$t:admin.profile.language.label', [
                {
                  type: 'form',
                  props: {
                    className: ROW_FORM_ONE,
                    'aria-label': '$t:admin.profile.language.formRegion',
                    // The testid sits on the FORM because a form FIELD carries no
                    // `props` bag — the schema names its accepted keys and
                    // `props` is not one of them, so `data-testid` cannot reach
                    // the `select`. The control inside is `select[name="language"]`.
                    'data-testid': 'profile-language',
                  },
                  endpoint: {
                    url: '/api/auth/update-user',
                    method: 'POST',
                    responseEnvelope: 'better-auth',
                    submitLabel: '$t:admin.profile.language.submit',
                    submitVariant: 'secondary',
                    // `reload`, and therefore NO `status`: the two are refused
                    // together at decode, and that refusal is the schema stating
                    // the trade this row makes. The console's language is read by
                    // the SERVER at render time, so the only honest way to show
                    // the choice taking effect is to let the server compose the
                    // page again. `refetch` cannot — it re-queries one region and
                    // skips any region holding a mounted island, and the sidebar
                    // is one.
                    //
                    // `message` stays required and is NOT displayed: the reload
                    // destroys the toast along with the document it would have
                    // appeared in. It is kept as the config's own record of what
                    // success means here.
                    //
                    // `profile-language-status` therefore never fills. The node
                    // stays — it is `empty:hidden!`, so it costs nothing, and it
                    // is the negative control PROFILE-005 reads to prove the name
                    // row reports on ITSELF rather than every target on the page.
                    onSuccess: {
                      type: 'toast',
                      variant: 'success',
                      message: '$t:admin.profile.language.saved',
                      reload: true,
                    },
                    onError: {
                      type: 'toast',
                      variant: 'destructive',
                      message: '$t:admin.profile.language.failed',
                    },
                  },
                  fields: [
                    {
                      field: 'language',
                      control: 'select',
                      label: '$t:admin.profile.language.label',
                      defaultValue: '$session.language',
                      description: '$t:admin.profile.language.hint',
                      // Language names are written in their own language and are
                      // never translated — "Français" is not "French" in French.
                      options: [
                        { value: 'en-US', label: 'English' },
                        { value: 'fr-FR', label: 'Français' },
                      ],
                    },
                  ],
                },
                status('profile-language-status'),
              ]),
              // ── Your data ────────────────────────────────────────────────
              //
              // The cross-link to the other half of the account. `href` belongs in
              // `props`, NOT at the top level: a top-level `href` validates (the
              // props bag is open) and renders a real `<a href="null">`. Caught
              // only by reading the live DOM, which is why both cross-links nest
              // it.
              row('$t:admin.profile.data.label', [
                {
                  type: 'container',
                  element: 'div',
                  // The same two-column shape the forms above make with their own
                  // grid, so this row's action lands under theirs rather than a
                  // paragraph's width to the left of them.
                  props: {
                    className:
                      'grid grid-cols-1 items-start gap-x-6 gap-y-2 sm:grid-cols-[minmax(0,26rem)_max-content]',
                  },
                  children: [
                    {
                      type: 'text',
                      element: 'p',
                      props: { className: ROW_HINT },
                      content: '$t:admin.profile.data.hint',
                    },
                    {
                      type: 'link',
                      content: '$t:admin.profile.gdprLink',
                      props: {
                        href: '/gdpr',
                        className:
                          'border-border-strong bg-background-raised text-foreground hover:bg-background-subtle inline-flex h-8 w-fit items-center rounded-[var(--radius-base,4px)] border px-3 text-base font-medium',
                        'data-testid': 'profile-gdpr-link',
                      },
                    },
                  ],
                },
              ]),
            ],
          },
        ],
      },
    ],
  } as PageConfig,
  { breadcrumb: { profile: '$t:admin.crumb.profile' } }
) satisfies PageConfig
