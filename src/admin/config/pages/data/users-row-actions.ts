/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Users — the account writes the directory and the one-account page share.
//
// Both grids carry the same row actions, each refetching its OWN grid. Built
// here, once, so the two pages cannot drift apart: a picker, a confirm or an
// endpoint changed on one grid and not the other is a control that means two
// things depending on where the operator met it. `users.ts` and
// `users-account.ts` each pass their grid id; nothing else differs.

import { ADMIN_GROUPS_ENDPOINT, ADMIN_ROLES_ENDPOINT } from '../../system-sources'

/**
 * The role picker's option source, shared by the directory's inline editor and
 * the invite form.
 *
 * `valueKey: 'name'` because a role name IS its identity — the endpoint's rows
 * are `{ name }` and no write endpoint accepts anything else. `labelKey` is the
 * same key: there is no separate display name for a role, and inventing one
 * would put a label in the picker that the operator cannot find in their config.
 */
export const ROLE_OPTIONS_SOURCE = {
  system: { endpoint: ADMIN_ROLES_ENDPOINT, rowsKey: 'roles' },
  valueKey: 'name',
  labelKey: 'name',
} as const

/**
 * The group picker's option source — every group in `auth.groups[]`.
 *
 * Keyed on `name` for the reason roles are: a group's name is the identity the
 * membership write accepts, and the label an operator can find in their config.
 * An app that declares no group gets an empty list here, and the write refuses
 * any name it does not declare, so the picker can never offer more than the
 * boundary allows.
 */
export const GROUP_OPTIONS_SOURCE = {
  system: { endpoint: ADMIN_GROUPS_ENDPOINT, rowsKey: 'groups' },
  valueKey: 'name',
  labelKey: 'name',
} as const

/**
 * The row action that sets an account's groups, built for whichever grid it
 * sits in so the directory and the account page cannot drift apart.
 *
 * It sits right after Change role on purpose: the two answer the same question
 * — what may this person do — a role being the one level an account holds and
 * groups the hats it wears on top of it. The picker is a LIST (`multiple`)
 * preset to what the account holds, and Save sends the whole picked set: the
 * write replaces the membership rather than adding to it, so an empty pick is
 * the answer "no group".
 *
 * No `responseEnvelope`: unlike the Better-Auth admin plugin, this route
 * answers its refusals with their own status (400 for an undeclared group, 422
 * past a group's member cap), so the status line is the truth.
 */
export const changeGroupsAction = (refetch: string) =>
  ({
    label: 'Change groups',
    editSelect: {
      field: 'groups',
      label: 'Groups',
      saveLabel: 'Save',
      multiple: true,
      optionsSource: GROUP_OPTIONS_SOURCE,
    },
    action: {
      type: 'fetch',
      url: '/api/admin/users/$record.id/groups',
      method: 'PUT',
      // `$record.groups` resolves to the PICKED list, sent as an array.
      body: { groups: '$record.groups' },
      onSuccess: { type: 'toast', message: 'Groups updated', refetch },
    },
  }) as const

/**
 * The row action that sets an account's role, through the Better-Auth admin
 * plugin's `set-role`.
 */
export const changeRoleAction = (refetch: string) =>
  ({
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
      onSuccess: { type: 'toast', message: 'Role updated', refetch },
    },
  }) as const

/** Ban an account — the one row gesture that takes access away, so it confirms. */
export const banAction = (refetch: string) =>
  ({
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
      onSuccess: { type: 'toast', message: 'Account banned', refetch },
    },
  }) as const

/** Lift a ban. */
export const liftBanAction = (refetch: string) =>
  ({
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
      onSuccess: { type: 'toast', message: 'Ban lifted', refetch },
    },
  }) as const
