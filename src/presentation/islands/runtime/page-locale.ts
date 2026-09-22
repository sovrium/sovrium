/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The active page locale for locale-aware display formats (`relative-time`).
 *
 * Reads the `<html lang>` attribute (set from the page's `meta.lang` via
 * `resolvePageLanguage`), so a French page (`meta.lang: 'fr-FR'`) renders the
 * French short form. Falls back to `en-US` outside a DOM (defensive) or when no
 * page lang is set.
 *
 * Lives in `shared/` rather than beside the data-table formatter because a
 * second island needs it: `record-field-system` formats its fetched value
 * through the same `formatCellValue`, and importing the grid's module for three
 * lines of DOM read would have pulled the grid's React cell renderers into the
 * record-field chunk.
 */
export function resolvePageLocale(): string {
  if (typeof document === 'undefined') return 'en-US'
  const { lang } = document.documentElement
  return lang.length > 0 ? lang : 'en-US'
}
