/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Dashboard "My profile" surface (`/_admin/profile`).
 *
 * The identity HALF of the operator's own account. [internal ref] split the single
 * "My account" page in two along the line the operator actually thinks in:
 *
 *   - **My profile** (here) — who I am and how I sign in: display name, email
 *     address, password.
 *   - **My data** (`gdpr-surface.ts`, `/_admin/gdpr`) — what the instance holds
 *     about me: export, erasure, pending requests.
 *
 * They were one page because the GDPR surface was built first and the identity
 * card rode along in it. Mixing them reads badly: "change my name" and "erase my
 * account for good" are not the same kind of decision, and putting a destructive
 * irreversible action one card below a text input invites the wrong click.
 *
 * ## No new backend
 *
 * All three forms are generic `form` components in the shipped ENDPOINT-bound
 * submit mode (`form.endpoint`, `src/domain/models/app/pages/components/
 * component-types/data/form/index.ts`), which POSTs `{ [field]: value }` to an
 * arbitrary url. Every target already ships:
 *
 * | Form     | Endpoint                          | Status                        |
 * |----------|-----------------------------------|-------------------------------|
 * | Name     | `POST /api/auth/update-user`      | Better Auth catch-all         |
 * | Email    | `POST /api/auth/change-email`     | `changeEmail.enabled: true`   |
 * | Password | `POST /api/auth/change-password`  | in the OpenAPI catalogue      |
 *
 * `responseEnvelope: 'better-auth'` on all three: these are Better-Auth routes,
 * which answer with their own envelope rather than Sovrium's `{ success }` shape.
 *
 * ## Two honest limits, STATED rather than designed around
 *
 * 1. **An email change does not take effect on submit.** Better Auth is
 *    configured with `changeEmail: { enabled: true, sendChangeEmailVerification: … }`
 *    (`better-auth/auth.ts`), so the address does not move until the verification
 *    link is followed. Measured live: `POST /api/auth/change-email` answers
 *    `200 {"status":true}` while `auth_user.email` is unchanged. A form that
 *    reports success over a value that did not change is read as broken, so the
 *    guidance line and the success status both name the pending step.
 *
 *    Caveat worth knowing before trusting that status on a real instance: the
 *    invitation/verification mailer swallows send failures by design, so on a
 *    host with no SMTP configured this reports "Verification link sent" and no
 *    mail is ever sent. That is pre-existing and shared with password reset and
 *    invitations; distinguishing the two states needs a "is mail configured"
 *    signal the surface builder does not have.
 * 2. **No avatar upload.** `auth.user.image` is a column that is READ in six
 *    places and WRITTEN by nothing — there is no upload handler and no wiring
 *    between it and the storage/buckets service anywhere in `src/`. A file input
 *    here would be a control with no destination, which is the same class of lie
 *    as a pager that cannot page. It is a capability gap for
 * `[internal ref]`, not something to improvise in a surface builder.
 */

import { homeCrumb, wrapInShell, type ShellBreadcrumbItem } from './dashboard-shell-surface'
import { dataPageIntro } from './data-object-rail'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/** Shared card chrome — byte-identical to the My data cards so the pair reads as one account. */
const CARD_CLASS = 'border-border bg-background-raised flex flex-col gap-3 rounded-md border p-5'

/** Card heading chrome. */
const CARD_HEADING = 'text-foreground text-lg font-semibold'

/** Explanatory body chrome. */
const CARD_BODY = 'text-foreground-subtle text-sm'

/**
 * A titled card wrapping one endpoint-bound form.
 *
 * @param ariaLabel - the section's accessible name (its landmark name)
 * @param heading - the visible heading, matching the landmark name
 * @param body - the one line of guidance beneath it
 * @param form - the form component
 */
function formCard(ariaLabel: string, heading: string, body: string, form: Component): Component {
  return {
    type: 'container',
    element: 'section',
    props: { className: CARD_CLASS, 'aria-label': ariaLabel },
    children: [
      // `h2`, not `h3`: the page title above is the `h1`, and a card sitting
      // directly under it is a second-level section. Skipping a level is a
      // WCAG 1.3.1 structure failure independent of how the heading looks.
      { type: 'text', element: 'h2', props: { className: CARD_HEADING }, content: heading },
      { type: 'text', element: 'p', props: { className: CARD_BODY }, content: body },
      form,
    ],
  } as unknown as Component
}

/**
 * Display-name form → `POST /api/auth/update-user`.
 *
 * Better Auth's self-service update endpoint is reachable through the
 * `/api/auth/*` catch-all; nothing in `src/` intercepts it. It is NOT in the
 * OpenAPI catalogue, which is a documentation gap rather than a functional one.
 */
function nameForm(): Component {
  return {
    type: 'form',
    props: { 'aria-label': 'Change your display name' },
    endpoint: {
      url: '/api/auth/update-user',
      method: 'POST',
      responseEnvelope: 'better-auth',
      submitLabel: 'Save name',
      onSuccess: {
        type: 'toast',
        variant: 'success',
        message: 'Name updated',
        status: { target: 'profile-name-status', message: 'Name updated' },
      },
      onError: { type: 'toast', variant: 'destructive', message: 'Could not update your name' },
    },
    fields: [{ field: 'name', control: 'text', label: 'Display name' }],
  } as unknown as Component
}

/**
 * Email-change form → `POST /api/auth/change-email`.
 *
 * The field is `newEmail` — Better Auth's own body key. The address does not
 * change on submit; a verification link is sent first. The guidance line says
 * that plainly, because a form that silently does nothing visible is read as
 * broken.
 */
function emailForm(): Component {
  return {
    type: 'form',
    props: { 'aria-label': 'Change your email address' },
    endpoint: {
      url: '/api/auth/change-email',
      method: 'POST',
      responseEnvelope: 'better-auth',
      submitLabel: 'Send verification link',
      onSuccess: {
        type: 'toast',
        variant: 'success',
        message: 'Verification link sent',
        status: {
          target: 'profile-email-status',
          message: 'Verification link sent. Your address changes once you follow it.',
        },
      },
      onError: { type: 'toast', variant: 'destructive', message: 'Could not send the link' },
    },
    fields: [{ field: 'newEmail', control: 'email', label: 'New email address' }],
  } as unknown as Component
}

/**
 * Password-change form → `POST /api/auth/change-password`.
 *
 * `revokeOtherSessions` is deliberately NOT sent: silently signing every other
 * device out is a consequential side effect, and this surface has no control to
 * offer it as a choice. Leaving it unset keeps the default rather than making
 * the decision on the operator's behalf without telling them.
 */
function passwordForm(): Component {
  return {
    type: 'form',
    props: { 'aria-label': 'Change your password' },
    endpoint: {
      url: '/api/auth/change-password',
      method: 'POST',
      responseEnvelope: 'better-auth',
      submitLabel: 'Change password',
      onSuccess: {
        type: 'toast',
        variant: 'success',
        message: 'Password changed',
        status: { target: 'profile-password-status', message: 'Password changed' },
      },
      onError: {
        type: 'toast',
        variant: 'destructive',
        message: 'Could not change your password — check your current one',
      },
    },
    fields: [
      { field: 'currentPassword', control: 'password', label: 'Current password' },
      { field: 'newPassword', control: 'password', label: 'New password' },
    ],
  } as unknown as Component
}

/** A form card's persistent inline status region (painted by `onSuccess.status`). */
function statusLine(id: string): Component {
  return {
    type: 'text',
    element: 'p',
    props: { id, className: 'text-foreground-subtle text-sm' },
    content: '',
  } as unknown as Component
}

/**
 * The signed-in operator's identity read-out: a session-bound `text`
 * (`session: 'email'`) resolved client-side. Mirrors the My data page's identity
 * card so the operator can confirm WHICH account they are about to change before
 * changing it.
 */
function identityCard(): Component {
  return {
    type: 'container',
    element: 'section',
    props: { className: CARD_CLASS, 'aria-label': 'Signed in as' },
    children: [
      { type: 'text', element: 'h2', props: { className: CARD_HEADING }, content: 'Signed in as' },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground text-sm', 'data-testid': 'profile-identity-email' },
        session: 'email',
      },
    ],
  } as unknown as Component
}

/**
 * The cross-link to the other half of the account. Both pages carry one, so an
 * operator who lands on either can reach the other without going back through
 * the profile menu — the split is only an improvement if both halves stay
 * findable.
 */
export function accountCrossLink(href: string, label: string): Component {
  return {
    type: 'link',
    content: label,
    // `href` belongs in `props`, NOT at the top level. A top-level `href`
    // validates (the schema's open `props` bag swallows nothing, and the extra
    // key is simply ignored) and renders a real `<a>` — with `href="null"`. It
    // was caught only by reading the live DOM, which is why every surface here
    // nests it the same way.
    props: {
      href,
      className: 'w-fit text-sm underline-offset-4 hover:underline',
    },
  } as unknown as Component
}

/** Shell-wrap concerns for the standalone My profile surface. */
export interface ProfileOptions {
  /** F6 tier / F5 editing flag; drives the read-only posture + sidebar affordances. */
  readonly canEdit: boolean
  /** Operator slug; seeds the shell sidebar brand label. */
  readonly appName?: string
  /** Operator config version (`app.version`); seeds the sidebar version chip. */
  readonly appVersion?: string
}

/**
 * Build the My profile page (`/_admin/profile`), wrapped in the persistent
 * 3-zone sidebar shell.
 *
 * @param title - the page meta title
 * @param options - tier + shell concerns
 */
export function buildProfilePage(title: string, options: ProfileOptions): Page {
  const { canEdit, appName, appVersion } = options
  const breadcrumb: ReadonlyArray<ShellBreadcrumbItem> = [
    homeCrumb(appName),
    { label: 'My profile' },
  ]
  const body: Component = {
    type: 'container',
    element: 'div',
    props: { className: 'flex max-w-3xl flex-col gap-6' },
    children: [
      // The page heading the cards sit under. Every other Data console page
      // routes its title through this same helper; without it this page's
      // outline began at a card heading, so "the top heading" identified a
      // section of some absent parent.
      dataPageIntro('Profile', 'Your account: how you appear, how you sign in.'),
      identityCard(),
      formCard(
        'Display name',
        'Display name',
        'The name shown beside your activity across the console.',
        nameForm()
      ),
      statusLine('profile-name-status'),
      formCard(
        'Email address',
        'Email address',
        'Your address changes only after you follow the verification link sent to the new address.',
        emailForm()
      ),
      statusLine('profile-email-status'),
      formCard(
        'Password',
        'Password',
        'Enter your current password, then the new one.',
        passwordForm()
      ),
      statusLine('profile-password-status'),
      accountCrossLink('/_admin/gdpr', 'Export or erase my data'),
    ],
  } as unknown as Component
  return {
    id: 'dashboard-profile',
    name: 'dashboard-profile',
    path: '/profile',
    meta: { title },
    components: wrapInShell([body], {
      canEdit,
      appName,
      appVersion,
      breadcrumb,
    }),
  } as Page
}
