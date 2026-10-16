/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A field or column name in words, the way a heading reads it: `due_date`,
 * `due-date` and `dueDate` all read "Due date". Only the first word is
 * capitalised; an empty or separator-only name reads as ''.
 */
export const nameInWords = (name: string): string => {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
  return words === '' ? '' : `${words.charAt(0).toUpperCase()}${words.slice(1)}`
}
