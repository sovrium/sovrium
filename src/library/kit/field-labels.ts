/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The words a block writes for a field it binds: a column header, a field
 * label. Kept beside the block kit so a block reads a bound field's name the
 * same way everywhere.
 */

/**
 * A field name in words, the way a column header reads it: `due_date` and
 * `dueDate` both read "Due date".
 */
const fieldInWords = (field: string): string => {
  const words = field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
  return words === '' ? '' : `${words.charAt(0).toUpperCase()}${words.slice(1)}`
}

/**
 * The label a block draws for a bound field: the `labelKey` parameter when the
 * operator set it, otherwise the field the `fieldKey` parameter names, in words.
 */
export const labelOf = (p: (key: string) => string, labelKey: string, fieldKey: string): string =>
  p(labelKey).trim() === '' ? fieldInWords(p(fieldKey)) : p(labelKey)
