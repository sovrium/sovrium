/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import { parseDatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'
import {
  users as authUsersPg,
  sessions as authSessionsPg,
  accounts as authAccountsPg,
  verifications as authVerificationsPg,
  teams as authTeamsPg,
  members as authMembersPg,
  teamMembers as authTeamMembersPg,
  organizations as authOrganizationsPg,
  oauthClients as authOauthClientsPg,
  oauthAccessTokens as authOauthAccessTokensPg,
} from '@/infrastructure/auth/better-auth/schema'
import { formSubmissions as formSubmissionsPg } from './schema/form-submissions'
import { fileStorageMetadata as fileStorageMetadataPg } from './schema/storage'
import {
  users as authUsersSqlite,
  sessions as authSessionsSqlite,
  accounts as authAccountsSqlite,
  verifications as authVerificationsSqlite,
  teams as authTeamsSqlite,
  members as authMembersSqlite,
  teamMembers as authTeamMembersSqlite,
  organizations as authOrganizationsSqlite,
  oauthClients as authOauthClientsSqlite,
  oauthAccessTokens as authOauthAccessTokensSqlite,
} from './schema-sqlite/auth-tables'
import { formSubmissions as formSubmissionsSqlite } from './schema-sqlite/form-submissions'
import { fileStorageMetadata as fileStorageMetadataSqlite } from './schema-sqlite/storage'

let CACHED_DIALECT: 'postgres' | 'sqlite' | undefined

const resolveDialect = (): 'postgres' | 'sqlite' => {
  CACHED_DIALECT ??= parseDatabaseDialectConfig().dialect
  return CACHED_DIALECT
}

export const resolveDialectSchema = <T>(pg: T, sqlite: unknown): T =>
  resolveDialect() === 'sqlite' ? (sqlite as T) : pg


export const formSubmissionsTable = (): typeof formSubmissionsPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (formSubmissionsSqlite as unknown as typeof formSubmissionsPg)
    : formSubmissionsPg

export const fileStorageMetadataTable = (): typeof fileStorageMetadataPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (fileStorageMetadataSqlite as unknown as typeof fileStorageMetadataPg)
    : fileStorageMetadataPg

export const authUsersTable = (): typeof authUsersPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (authUsersSqlite as unknown as typeof authUsersPg)
    : authUsersPg

export const authSessionsTable = (): typeof authSessionsPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (authSessionsSqlite as unknown as typeof authSessionsPg)
    : authSessionsPg

export const authAccountsTable = (): typeof authAccountsPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (authAccountsSqlite as unknown as typeof authAccountsPg)
    : authAccountsPg

export const authVerificationsTable = (): typeof authVerificationsPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (authVerificationsSqlite as unknown as typeof authVerificationsPg)
    : authVerificationsPg

export const authTeamsTable = (): typeof authTeamsPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (authTeamsSqlite as unknown as typeof authTeamsPg)
    : authTeamsPg

export const authMembersTable = (): typeof authMembersPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (authMembersSqlite as unknown as typeof authMembersPg)
    : authMembersPg

export const authTeamMembersTable = (): typeof authTeamMembersPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (authTeamMembersSqlite as unknown as typeof authTeamMembersPg)
    : authTeamMembersPg

export const authOrganizationsTable = (): typeof authOrganizationsPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (authOrganizationsSqlite as unknown as typeof authOrganizationsPg)
    : authOrganizationsPg

export const authOauthClientsTable = (): typeof authOauthClientsPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (authOauthClientsSqlite as unknown as typeof authOauthClientsPg)
    : authOauthClientsPg

export const authOauthAccessTokensTable = (): typeof authOauthAccessTokensPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (authOauthAccessTokensSqlite as unknown as typeof authOauthAccessTokensPg)
    : authOauthAccessTokensPg

export const authTableRef = (
  name:
    | 'user'
    | 'session'
    | 'account'
    | 'team'
    | 'member'
    | 'team_member'
    | 'oauth_client'
    | 'oauth_access_token'
    | 'verification'
): SQL =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? sql.raw(`auth_${name}`)
    : sql.raw(`auth.${name}`)
