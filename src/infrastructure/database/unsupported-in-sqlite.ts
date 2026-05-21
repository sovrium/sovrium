/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data } from 'effect'
import { parseDatabaseDialectConfig } from '@/domain/models/env/database-dialect'


export class UnsupportedInSqliteError extends Data.TaggedError('UnsupportedInSqliteError')<{
  readonly feature: string
  readonly message: string
}> {}

export const isSqliteRuntime = (): boolean => parseDatabaseDialectConfig().dialect === 'sqlite'
