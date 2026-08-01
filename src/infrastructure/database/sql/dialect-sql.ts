/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { parseDatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'
import { nowSqlLiteral } from './dialect-ddl'


export const nowExpr = () => sql.raw(nowSqlLiteral())

export const authTableRef = (name: string) =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? sql.raw(`auth_${name}`)
    : sql.raw(`auth.${name}`)

export const sqliteSystemTableName = (name: string) => `system_${name}`

export const systemTableRef = (name: string) =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? sql.raw(sqliteSystemTableName(name))
    : sql.raw(`system."${name}"`)

export const authUserTableRef = () => authTableRef('user')
