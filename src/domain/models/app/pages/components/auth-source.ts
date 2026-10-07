/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The account lists a settings page draws — `dataSource: { auth: <list> }`.
 *
 * ─── WHY A CLOSED NAME AND NOT AN ENDPOINT ────────────────────────────────
 *
 * A `system` source names an endpoint path, and the page then trusts whatever
 * that endpoint returns. For these five lists the SCOPE is the whole point —
 * the reader's own sessions, never someone else's — so the engine owns the
 * read: the name picks the list, the server scopes it to the session, and no
 * config can widen it. A block shipping `{ auth: sessions }` is therefore
 * correct in every app, where a block shipping an endpoint path would be
 * correct only until the path moved.
 *
 * | Name          | Rows (each also carries the `id` an account method targets)        | Who may read it     |
 * | ------------- | ------------------------------------------------------------------- | ------------------- |
 * | `passkeys`    | The reader's passkeys: `name`, `deviceType`, `createdAt`            | the reader          |
 * | `sessions`    | The reader's sessions: `device`, `ipAddress`, `lastActiveAt`, `current` | the reader      |
 * | `apiKeys`     | The reader's API keys: `name`, `prefix`, `lastUsedAt`, `expiresAt` (never the key) | the reader |
 * | `members`     | The app's members: `name`, `email`, `image`, `role`, `joinedAt`     | administer-accounts |
 * | `invitations` | Pending invitations: `email`, `role`, `invitedBy`, `sentAt`, `expiresAt` | administer-accounts |
 *
 * A reader without the capability a list needs gets no rows and the component
 * is not drawn, the same anti-enumeration answer every gated read gives.
 */

import { Schema } from 'effect'

export const AUTH_SOURCE_LISTS = [
  'passkeys',
  'sessions',
  'apiKeys',
  'members',
  'invitations',
] as const

export const AuthSourceListSchema = Schema.Literals([...AUTH_SOURCE_LISTS]).annotate({
  identifier: 'AuthSourceList',
  title: 'Auth Source List',
  description:
    'Which account list to read: the reader’s own passkeys, sessions or API keys, or — for a reader who may administer accounts — the members and the pending invitations',
})

export const AuthSourceSchema = Schema.Struct({
  auth: AuthSourceListSchema,
}).annotate({
  identifier: 'AuthSource',
  title: 'Auth Source',
  description:
    'Bind a list or a table to an account list the server scopes to the reader (passkeys, sessions, apiKeys, members, invitations)',
})
