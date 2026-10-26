/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { rewriteDatePartsToPortable } from './formula-date-parts'
import { rewriteIfToCase } from './formula-if-case'
import { translatePortableDates } from './formula-portable-dates'

type FieldLike = { readonly name: string; readonly type: string }

/**
 * The passes both translators run first, so a formula means one thing on both
 * engines: the spreadsheet date parts become `date_part_utc` (`YEAR(x)`), the
 * portable date functions become the engine's SQL, and `IF` becomes `CASE`.
 *
 * @throws {FormulaDatePartArityError} when a date part does not take exactly one argument
 * @throws {PortableDatePartError} when a `date_part_utc` part is not offered
 * @throws {FormulaIfArityError} when an `IF` has fewer than two arguments
 */
export const translatePortableFunctions = (
  formula: string,
  fields: readonly FieldLike[],
  dialect: 'postgres' | 'sqlite'
): string =>
  rewriteIfToCase(translatePortableDates(rewriteDatePartsToPortable(formula), fields, dialect))
