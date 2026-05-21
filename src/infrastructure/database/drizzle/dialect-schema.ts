/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parseDatabaseDialectConfig } from '@/domain/models/env/database-dialect'
import {
  users as authUsersPg,
  sessions as authSessionsPg,
} from '@/infrastructure/auth/better-auth/schema'
import { formSubmissions as formSubmissionsPg } from './schema/form-submissions'
import {
  users as authUsersSqlite,
  sessions as authSessionsSqlite,
} from './schema-sqlite/auth-tables'
import { formSubmissions as formSubmissionsSqlite } from './schema-sqlite/form-submissions'


export const formSubmissionsTable = (): typeof formSubmissionsPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (formSubmissionsSqlite as unknown as typeof formSubmissionsPg)
    : formSubmissionsPg

export const authUsersTable = (): typeof authUsersPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (authUsersSqlite as unknown as typeof authUsersPg)
    : authUsersPg

export const authSessionsTable = (): typeof authSessionsPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (authSessionsSqlite as unknown as typeof authSessionsPg)
    : authSessionsPg
