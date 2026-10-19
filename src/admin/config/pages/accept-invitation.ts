/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Where an invited operator lands from the email: who invited them, to which
// app, under which address — and one password to set.
//
// Public at exactly this path, like `/login`: the invitee has no account yet.
// It draws the sign-in card's frame (shadcn's login-03: the app's mark and
// name above one card on a muted ground) so the first console page someone
// sees and the one they will sign in on are the same place.
//
// `invitation: {}` reads the invitation the `?token=` names. A token that is
// expired, used or unknown draws one card saying the link no longer works and
// pointing to sign-in, without saying whether it ever was valid.
//
// The page renders inside the document's own `main`: the card is a `section`,
// never a second landmark.

import type { Page as PageConfig } from '@/domain/models/app'

type PageComponent = NonNullable<PageConfig['components']>[number]

/**
 * One sentence put together from translated words and invitation values. A
 * `$t:` string is looked up whole, so the values sit in their own spans
 * between the translated parts rather than inside them.
 */
const sentence = (testId: string, parts: readonly string[]): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'flex flex-wrap justify-center gap-x-1 text-sm text-muted-foreground',
      'data-testid': testId,
    },
    children: parts.map((content) =>
      content.startsWith('$invitation.')
        ? {
            type: 'text',
            element: 'span',
            // A role id reads as a word ("member" → "Member").
            props: {
              className: `font-medium text-foreground${content === '$invitation.role' ? ' capitalize' : ''}`,
            },
            content,
          }
        : { type: 'text', element: 'span', content }
    ),
  }) as PageComponent

/**
 * The address the account will carry, and the one password it needs. The
 * engine leaves the form out unless the invitation can still be answered.
 */
const answer = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-4 px-4' },
    children: [
      sentence('invitation-email', ['$t:admin.invitation.signInAs', '$invitation.email']),
      {
        type: 'form',
        action: {
          type: 'auth',
          method: 'acceptInvitation',
          submitLabel: '$t:admin.invitation.submit',
          onSuccess: { navigate: '/' },
        },
        props: { id: 'admin-accept-invitation-form' },
      },
      sentence('invitation-expiry', ['$t:admin.invitation.worksUntil', '$invitation.expiresAt']),
    ],
  }) as PageComponent

/** Rendered only while the token names a pending invitation. */
const PENDING = { condition: { field: '$invitation.status', operator: 'eq', value: 'pending' } }

/**
 * The link that no longer works — expired, already used or never issued, and
 * the page does not say which. It says what happened and where to go next, as
 * shadcn's Empty does, instead of the valid card's sentences with their
 * values missing.
 */
const unusable = (): PageComponent =>
  ({
    type: 'card',
    visibility: {
      condition: { field: '$invitation.status', operator: 'neq', value: 'pending' },
    },
    props: {
      className: 'flex flex-col items-center gap-2 px-6 py-8 text-center text-sm',
      'data-testid': 'invitation-unusable',
    },
    children: [
      {
        type: 'text',
        element: 'h1',
        props: { className: 'text-lg font-medium text-foreground' },
        content: '$t:admin.invitation.unusable.heading',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-muted-foreground text-balance' },
        content: '$t:admin.invitation.unusable.body',
      },
      {
        type: 'link',
        props: {
          href: '/login',
          className:
            'mt-2 inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground no-underline shadow-xs hover:bg-muted',
        },
        content: '$t:admin.invitation.unusable.signIn',
      },
    ],
  }) as PageComponent

export default {
  id: 'dashboard-accept-invitation',
  name: 'dashboard-accept-invitation',
  path: '/accept-invitation',
  invitation: {},
  meta: { title: '$t:admin.meta.acceptInvitation', noindex: true },
  components: [
    {
      type: 'container',
      element: 'section',
      props: {
        className:
          'flex min-h-svh w-full flex-col items-center justify-center gap-6 p-6 md:p-10 bg-muted',
        'data-admin-base-path': '/',
      },
      children: [
        {
          type: 'flex',
          props: { className: 'flex w-full max-w-sm flex-col gap-6' },
          children: [
            {
              type: 'container',
              element: 'div',
              props: {
                className:
                  'flex items-center gap-2 self-center text-sm font-medium text-foreground',
              },
              children: [
                {
                  type: 'container',
                  props: {
                    className:
                      'flex size-6 items-center justify-center overflow-hidden rounded-md bg-primary text-xs font-semibold text-primary-foreground data-[app-mark=logo]:bg-transparent',
                    'data-app-mark': 'tile',
                  },
                },
                // The app's own name, which an unusable link still has.
                { type: 'text', element: 'span', content: '$app.label' },
              ],
            },
            {
              type: 'card',
              visibility: PENDING,
              props: {
                'data-slot': 'card',
                className: 'flex flex-col gap-4 overflow-hidden px-0 py-4 text-sm',
              },
              children: [
                {
                  type: 'container',
                  props: {
                    'data-slot': 'card-header',
                    className: 'grid auto-rows-min gap-1 px-4 text-center',
                  },
                  children: [
                    {
                      type: 'text',
                      element: 'h1',
                      props: {
                        className: 'font-medium leading-snug text-foreground text-xl',
                        'data-slot': 'card-title',
                      },
                      content: '$t:admin.invitation.heading',
                    },
                    sentence('invitation-blurb', [
                      '$invitation.inviter.name',
                      '$t:admin.invitation.invitedYouTo',
                      '$invitation.workspace',
                      '$t:admin.invitation.asRole',
                      '$invitation.role',
                    ]),
                  ],
                },
                answer(),
              ],
            },
            unusable(),
          ],
        },
      ],
    } as PageComponent,
  ],
} satisfies PageConfig
