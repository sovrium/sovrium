/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared SQL predicates over the Better Auth `user` table.
 *
 * One rule lives here today, and it is the kind of rule that must live in
 * exactly one place: **an AI agent is not a person.**
 *
 * `app.agents[]` entries are mirrored into `auth.user` with a synthetic
 * `{name}@agents.sovrium.local` address so they inherit RBAC exactly as a human
 * account does (`AgentPermissionsSchema`, `agent-user-sync.ts`). That is a good
 * design for authorization and a trap for every read that answers the question
 * "who are our users?". `AgentPermissionsSchema` already states the contract —
 * *"Agent users are excluded from user list by default"* — and Better Auth's own
 * `/api/auth/admin/list-users` honours it, but each
 * bespoke admin read that goes to the table directly has to opt in by hand. Two
 * of them did not, and listed the app's automation as staff.
 *
 * The email SUFFIX is the predicate rather than the `type = 'agent'` column
 * because the column is added by runtime DDL on PostgreSQL only and does not
 * exist on SQLite — the suffix is the only portable discriminator.
 */

import { notEndsWithInsensitive, type LikeOperand } from './dialect-sql-helpers'
import type { SQL } from 'drizzle-orm'

/** Accounts mirrored from `app.agents[]` carry this email suffix. */
const AGENT_EMAIL_SUFFIX = '@agents.sovrium.local'

/**
 * `WHERE` fragment excluding agent-mirrored accounts from a people-oriented
 * read. Pass the query's `email` column.
 *
 * The suffix is handed over as raw text rather than as a pre-built `%…` pattern:
 * {@link notEndsWithInsensitive} owns both the wildcard and the metacharacter
 * escaping. Today's constant contains no `%` or `_`, so the escaping is a no-op
 * on it — the point is that adding one later cannot silently turn this exclusion
 * into a wildcard that stops excluding.
 */
/* eslint-disable functional/prefer-immutable-types -- SQL | Column are upstream drizzle-orm types; we never mutate them */
export const notAnAgentAccount = (emailColumn: LikeOperand): SQL =>
  notEndsWithInsensitive(emailColumn, AGENT_EMAIL_SUFFIX)
