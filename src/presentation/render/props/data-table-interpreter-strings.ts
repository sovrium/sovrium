/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  resolveInterpreterString,
  resolveInterpreterStringOverrides,
} from '@/domain/models/app/languages/translation-resolver'
import type { Languages } from '@/domain/models/app/languages'

/**
 * The grid island's interpreter-provided strings, resolved against the active
 * page language: English default, French built-in, and an author
 * `languages.translations[<lang>]['sovrium.<key>']` override wins.
 *
 * - `newRecordLabel` labels the toolbar create button and the create
 *   modal's title / aria-label.
 * - `saveLabel` / `cancelLabel` label the create dialog's footer pair and the
 *   inline editor's commit / dismiss pair (an `editSelect.saveLabel` still
 *   overrides the commit).
 * - `uiStrings` carries every other string the grid writes itself — toolbar,
 *   pager, search default, add-row, the rate-limited read notice, the
 *   selection bar's Confirm / Cancel (`confirmGate.*`) — and only
 *   where it differs from the English
 *   the island is written in, so it is absent on an English page and that
 *   page's markup is unchanged.
 */
export function dataTableInterpreterStrings(
  currentLang: string | undefined,
  languages: Languages | undefined
) {
  return {
    newRecordLabel: resolveInterpreterString('datatable.newRecord', currentLang, languages),
    saveLabel: resolveInterpreterString('datatable.save', currentLang, languages),
    cancelLabel: resolveInterpreterString('datatable.cancel', currentLang, languages),
    uiStrings: resolveInterpreterStringOverrides(
      ['datatable.', 'rateLimit.', 'confirmGate.'],
      currentLang,
      languages
    ),
  }
}
