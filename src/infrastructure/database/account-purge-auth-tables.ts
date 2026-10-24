/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Auth-schema tables the purge DELETES from, keyed by their bare name.
 *
 * Separate from `PURGED_SYSTEM_TABLES` (`account-purge-coverage.ts`) only because they resolve through
 * `authTableRef` (`auth.x` / `auth_x`) rather than `systemTableRef`.
 */
export const PURGED_AUTH_TABLES = [
  {
    table: 'oauth_access_token',
    column: 'user_id',
    reason:
      'A LIVE BEARER TOKEN. `user_id` is `ON DELETE SET NULL` while every sibling ' +
      '(`oauth_client`, `oauth_refresh_token`, `oauth_consent`) cascades — the one ' +
      'inconsistency in the OAuth family, and the most dangerous place to have it. ' +
      'A token whose `refresh_id` is set is taken out by the refresh row cascading, ' +
      'but a token issued WITHOUT a refresh token has a NULL `refresh_id` and ' +
      'nothing removes it: erasure left an ownerless credential that still ' +
      'authenticates. Deleted before the user row so the SET NULL never fires.',
  },
  {
    table: 'oauth_client',
    column: 'user_id',
    reason: 'OAuth clients the user registered. Cascades; named.',
  },
  {
    table: 'oauth_refresh_token',
    column: 'user_id',
    reason: 'Long-lived refresh credentials. Cascades; named.',
  },
  {
    table: 'oauth_consent',
    column: 'user_id',
    reason: 'Recorded grants of consent to third-party clients. Cascades; named.',
  },
  {
    table: 'api_key',
    column: 'reference_id',
    reason:
      'Personal API keys — credentials, keyed by `reference_id` rather than ' +
      '`user_id` (Better Auth naming). Cascades; named.',
  },
  {
    table: 'member',
    column: 'user_id',
    reason: 'Organization memberships. Cascades; named.',
  },
  {
    table: 'team_member',
    column: 'user_id',
    reason: 'Team memberships. Cascades; named.',
  },
  {
    table: 'invitation',
    column: 'inviter_id',
    reason:
      'Invitations the user SENT, which carry the invitee address alongside the ' +
      'erased inviter. Cascades; named.',
  },
] as const
