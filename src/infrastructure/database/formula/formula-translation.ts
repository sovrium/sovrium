/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { translateFormulaToSqlite } from './formula-sqlite-translation'
import { translateFormulaToPostgres } from './formula-utils'

export const translateFormula = (
  formula: string,
  allFields?: readonly { name: string; type: string }[]
): string =>
  isSqliteRuntime()
    ? translateFormulaToSqlite(formula, allFields)
    : translateFormulaToPostgres(formula, allFields)
