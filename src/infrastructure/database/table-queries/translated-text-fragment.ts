/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  EVERY_LANGUAGE,
  isTranslatedTextValue,
  TRANSLATED_TEXT_OPERATOR,
} from '@/domain/models/app/tables/translatable-query-service'
import { allLanguagesTextSqlOn, languageValueSqlOn } from '../sql/translatable-value-sql'
import { validateColumnName } from './statement/validation'
import type { DatabaseDialect } from '@/domain/models/process-env/database/database-dialect'
import type { SQL } from 'drizzle-orm'

/** One condition: the field it reads, the operator and the value. */
export interface Condition {
  readonly field: string
  readonly operator: string
  readonly value: unknown
}

/** The condition compiler, handed in so this module stays a leaf of it. */
type CompileCondition = (condition: Condition, column: Readonly<SQL>) => Readonly<SQL>

/**
 * The condition of a rewritten condition on a translatable field
 * (`translatable-query-service.ts`): the caller's operator and value, compiled
 * against one language's value of the map, or against every value at once for
 * a search. `undefined` for any other condition.
 *
 * Reached only through `TRANSLATED_TEXT_OPERATOR`, which only the server's own
 * rewrite produces: the records API refuses it from a caller as an unknown
 * operator.
 */
export const translatedTextFragment = (
  dialect: DatabaseDialect,
  condition: Condition,
  compile: CompileCondition
): Readonly<SQL> | undefined => {
  const { field, operator, value } = condition
  if (operator !== TRANSLATED_TEXT_OPERATOR || !isTranslatedTextValue(value)) return undefined
  validateColumnName(field)
  const text =
    value.language === EVERY_LANGUAGE
      ? allLanguagesTextSqlOn(dialect, field)
      : languageValueSqlOn(dialect, field, value.language)
  return compile({ field, operator: value.operator, value: value.value }, text)
}
