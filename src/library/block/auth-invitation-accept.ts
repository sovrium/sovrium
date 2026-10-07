/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  appMark,
  authColumn,
  authHeading,
  authPage,
  footerLink,
} from '@/library/manifest/auth-block-kit'
import { asComponent, param, stringParam, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

type Node = Readonly<Record<string, unknown>>

/** Draw `node` only when the invitation in the address has `status`. */
const whenStatus = (status: string, node: Node): Node => ({
  ...node,
  visibility: { condition: { field: '$invitation.status', operator: 'eq', value: status } },
})

/** One fact of the invitation: a label and its value. */
const fact = (label: string, value: string): Node => ({
  type: 'flex',
  props: { className: 'flex items-baseline justify-between gap-4 py-2' },
  children: [
    {
      type: 'text',
      element: 'span',
      props: { className: 'text-md text-foreground-muted' },
      content: label,
    },
    {
      type: 'text',
      element: 'span',
      props: { className: 'text-md text-foreground' },
      content: value,
    },
  ],
})

/** The pending invitation: who, to what, and the two decisions. */
const pendingVariant = (successPath: string, signInPath: string): Node =>
  authColumn([
    authHeading(
      '$invitation.inviter.name invited you to $invitation.workspace',
      'Accept to join with the email the invitation was sent to.'
    ),
    {
      type: 'flex',
      props: { className: 'flex flex-col divide-y divide-border border-y border-border' },
      children: [
        fact('Email', '$invitation.email'),
        fact('Role', '$invitation.role'),
        fact('Expires', '$invitation.expiresAt'),
      ],
    },
    {
      type: 'form',
      action: {
        type: 'auth',
        method: 'acceptInvitation',
        submitLabel: 'Accept and join',
        onSuccess: { navigate: successPath },
      },
    },
    {
      type: 'form',
      action: {
        type: 'auth',
        method: 'declineInvitation',
        submitLabel: 'Decline',
        onSuccess: { navigate: signInPath },
      },
    },
  ])

/** An invitation that cannot be accepted: one sentence, and the way to sign in. */
const closedVariant = (title: string, sentence: string, signInPath: string): Node =>
  authColumn([authHeading(title, sentence), footerLink('Already a member?', 'Sign in', signInPath)])

/** The screen an invitation link opens: who invited you, to what, and one decision. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'auth-invitation-accept',
  title: 'Invitation accept page',
  category: 'application',
  tags: ['auth', 'invitation', 'invite', 'team', 'join'],
  description:
    'The screen an invitation email opens: who invited the reader, to which workspace and role, and the choice to accept and join or decline — or a plain sentence when the link is not valid any more.',
  notes: [
    'Place it on a page that declares `invitation: {}` — that is what reads the token from the address and exposes the invitation as `$invitation.*`. The built-in invitation email links to `/accept-invitation`, so give that page this path: it then replaces the built-in page.',
    'A link that matches no outstanding invitation — mistyped, already used, or revoked — reads "This invitation link is not valid", and an expired one says so; neither offers to accept. Nothing on the page says whether the invitation ever existed.',
    THEME_NOTE,
  ],
  params: [
    stringParam('iconName', 'The icon drawn as the app mark.', 'box'),
    stringParam('successPath', 'Where a new member lands.', '/'),
    stringParam('signInPath', 'The sign-in page.', '/sign-in'),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      authPage(
        [
          appMark(p('iconName')),
          whenStatus('pending', pendingVariant(p('successPath'), p('signInPath'))),
          whenStatus(
            'expired',
            closedVariant(
              'This invitation has expired',
              'Ask the person who invited you to send a new one.',
              p('signInPath')
            )
          ),
          whenStatus(
            'invalid',
            closedVariant(
              'This invitation link is not valid',
              'It may have been mistyped or already used. Ask for a new invitation.',
              p('signInPath')
            )
          ),
        ],
        true
      )
    )
  },
})
