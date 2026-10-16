/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { escapeLikeMetacharacters } from './sql-formatting'

/** The text operators a LIKE pattern answers. */
export type LikeOperator = 'contains' | 'startsWith' | 'endsWith'

/**
 * The LIKE pattern of a text operator over `text`, its metacharacters escaped
 * ({@link escapeLikeMetacharacters}): only the wildcards the operator itself
 * contributes stay active. Bound as one parameter, beside an `ESCAPE` clause
 * naming `LIKE_ESCAPE_CHARACTER` — the two ship together.
 */
export const likePatternOf = (operator: LikeOperator, text: string): string => {
  const escaped = escapeLikeMetacharacters(text)
  if (operator === 'startsWith') return `${escaped}%`
  if (operator === 'endsWith') return `%${escaped}`
  return `%${escaped}%`
}
