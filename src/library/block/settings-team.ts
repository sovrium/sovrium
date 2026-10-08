/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent, param, stringParam, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import {
  SETTINGS_PLACE_NOTE,
  settingsColumn,
  settingsGroup,
  settingsListRow,
  settingsTitle,
} from '@/library/manifest/settings-block-kit'

type Node = Readonly<Record<string, unknown>>

/** The three built-in roles, offered by the role picker and the invite form. */
const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
] as const

/** The members grid: name, email, role with its picker, and when they joined. */
const membersGrid = (): Node => ({
  type: 'table',
  props: { 'aria-label': 'Members' },
  dataSource: { auth: 'members' },
  columns: [
    { field: 'name', label: 'Name' },
    { field: 'email', label: 'Email' },
    { field: 'role', label: 'Role' },
    { field: 'joinedAt', label: 'Joined', format: 'short-date' },
    {
      type: 'actions',
      actions: [
        {
          label: 'Change role',
          variant: 'ghost',
          editSelect: { field: 'role', label: 'Role', saveLabel: 'Save', options: ROLE_OPTIONS },
          action: { type: 'auth', method: 'setRole', target: '$record.id' },
        },
      ],
    },
  ],
})

/** The pending invitations grid, each with resend and revoke. */
const invitationsGrid = (): Node => ({
  type: 'table',
  props: { 'aria-label': 'Pending invitations' },
  dataSource: { auth: 'invitations' },
  columns: [
    { field: 'email', label: 'Email' },
    { field: 'role', label: 'Role' },
    { field: 'sentAt', label: 'Sent', format: 'relative-date' },
    { field: 'expiresAt', label: 'Expires', format: 'short-date' },
    {
      type: 'actions',
      actions: [
        {
          label: 'Resend',
          variant: 'ghost',
          action: { type: 'auth', method: 'resendInvitation', target: '$record.id' },
        },
        {
          label: 'Revoke',
          variant: 'ghost',
          action: { type: 'auth', method: 'revokeInvitation', target: '$record.id' },
          confirm: {
            title: 'Revoke this invitation?',
            message: 'The link in their email stops working.',
            confirmLabel: 'Revoke invitation',
          },
        },
      ],
    },
  ],
  emptyMessage: 'No invitation waiting. Invite someone to see it here until they join.',
})

/** The invite dialog: an email, a name and a role; the built-in email does the rest. */
const inviteDialog = (dialogId: string, defaultRole: string): Node => ({
  type: 'dialog',
  visibility: { capability: 'administer-accounts' },
  props: {
    id: dialogId,
    title: 'Invite someone',
    description: 'They get an email with a link to join. It expires in three days.',
  },
  children: [
    {
      type: 'form',
      endpoint: {
        url: '/api/auth/admin/invite-user',
        method: 'POST',
        responseEnvelope: 'better-auth',
        submitLabel: 'Send invitation',
        onSuccess: { type: 'toast', variant: 'success', message: 'Invitation sent.', reload: true },
        onError: {
          type: 'toast',
          variant: 'destructive',
          message: 'The invitation could not be sent. Check the address and try again.',
        },
      },
      fields: [
        { field: 'email', control: 'email', label: 'Email' },
        { field: 'name', control: 'text', label: 'Name' },
        {
          field: 'role',
          control: 'select',
          label: 'Role',
          defaultValue: defaultRole,
          options: ROLE_OPTIONS,
        },
      ],
    },
  ],
})

/** The workspace's people: members with their roles, pending invitations, and invite. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'settings-team',
  title: 'Team settings',
  category: 'application',
  tags: ['settings', 'team', 'members', 'invitations', 'roles', 'invite'],
  description:
    'The team page of a workspace: every member with their role and a way to change it, the invitations still waiting with resend and revoke, and an invite dialog.',
  notes: [
    SETTINGS_PLACE_NOTE,
    'Both lists and the Invite button are left off the page for a reader who may not administer accounts, and for a visitor, so the block can sit on a page every member reaches.',
    'Invite sends the built-in invitation email, whose link opens the page that declares `invitation` — the one carrying the `auth-invitation-accept` block. Sending reloads the page, which closes the dialog and lists the new invitation.',
    'The copy says invitation links work for three days, the default. If you set `auth.invitationTokenExpiry`, change the two sentences that name the duration.',
    'The role picker and the invite form offer the three built-in roles. Add your own roles to their `options`.',
    THEME_NOTE,
  ],
  params: [
    stringParam('headline', 'The page heading.', 'Team'),
    stringParam('defaultRole', 'The role an invitation gives unless changed.', 'member'),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    const dialogId = `${name}-invite`
    return asComponent(
      name,
      settingsColumn(
        [
          settingsTitle(p('headline'), 'Who can sign in to $app.label, and what they can do.'),
          settingsGroup(
            'Members',
            'Change a role to change what someone can see and do.',
            [settingsListRow([membersGrid()])],
            {
              side: [
                {
                  type: 'button',
                  visibility: { capability: 'administer-accounts' },
                  props: { label: 'Invite', interactions: { click: { modal: dialogId } } },
                },
              ],
            }
          ),
          settingsGroup(
            'Pending invitations',
            'Each invitation link works for three days, then expires.',
            [settingsListRow([invitationsGrid()])]
          ),
          inviteDialog(dialogId, p('defaultRole')),
        ],
        true
      )
    )
  },
})
