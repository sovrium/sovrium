/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { UncompilableFilterOperatorError } from '@/domain/errors/uncompilable-filter-operator-error'

/**
 * An operator neither SQL compiler knows fails closed, as a typed refusal:
 * compiling it as `=` (the old fallback) selected the very rows a misspelt
 * negation meant to leave out. The compilers stay synchronous — the DDL
 * generators calling them run where no Effect exists — so the refusal is
 * thrown, and each runtime boundary passes it through as itself rather than
 * folding it into a database error.
 */
export const unknownOperator = (operator: string): never => {
  throw new UncompilableFilterOperatorError(
    `filter operator "${operator}" cannot be compiled into SQL`,
    operator
  )
}
