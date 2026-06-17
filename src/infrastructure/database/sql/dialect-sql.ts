/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { parseDatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'


export const nowExpr = () =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? sql.raw('CURRENT_TIMESTAMP')
    : sql.raw('NOW()')

export const authTableRef = (name: string) =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? sql.raw(`auth_${name}`)
    : sql.raw(`auth.${name}`)

export const authUserTableRef = () => authTableRef('user')
