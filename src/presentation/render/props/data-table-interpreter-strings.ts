/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { fillPlaceholders } from '@/domain/kernel/format/placeholder-format'
import { DEFAULT_INTERPRETER_LANG } from '@/domain/models/app/languages/interpreter-ui-strings'
import {
  resolveInterpreterString,
  resolveInterpreterStringOverrides,
  resolveTranslationPattern,
} from '@/domain/models/app/languages/translation-resolver'
import { humanizeFieldName } from '@/presentation/design/string-utils'
import type { Languages } from '@/domain/models/app/languages'
import type { TableDisplayNames } from '@/domain/models/app/tables/table-display-name-service'

/**
 * A row action's built-in in-flight words, read by the grid while its request
 * is open, and a button field's `action.*` words (its in-flight caption and the
 * outcome of its run).
 */
const ROW_ACTION_PENDING_KEYS = ['form.saving', 'form.deleting', 'form.sending', 'action.']

/**
 * The grid island's interpreter-provided strings, resolved against the active
 * page language: English default, French built-in, and an author
 * `languages.translations[<lang>]['sovrium.<key>']` override wins.
 *
 * - `saveLabel` / `cancelLabel` label the inline editor's commit / dismiss
 *   pair (an `editSelect.saveLabel` still overrides the commit).
 * - `uiStrings` carries every other string the grid writes itself — pager,
 *   selection bar, add-row, the rate-limited read notice, the
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
    saveLabel: resolveInterpreterString('datatable.save', currentLang, languages),
    cancelLabel: resolveInterpreterString('datatable.cancel', currentLang, languages),
    uiStrings: resolveInterpreterStringOverrides(
      ['datatable.', 'rateLimit.', 'confirmGate.', 'sharedFilter.', ...ROW_ACTION_PENDING_KEYS],
      currentLang,
      languages
    ),
  }
}

/**
 * What an empty grid bound to a table says when its author wrote no
 * `emptyMessage`: the table, named — `Suppliers has no records yet` — by its
 * `labelPlural`, else its `label`, else its name made readable
 * (`price_lists` → `Price Lists`), in the page language. "No records found"
 * under a grid tells the reader nothing about WHICH collection is empty, on a
 * page that may show any of an app's tables.
 *
 * `undefined` for a grid bound to no table (a system source), which keeps the
 * generic message.
 */
export function tableEmptyMessage(
  names: TableDisplayNames | undefined,
  currentLang: string | undefined,
  languages: Languages | undefined
): string | undefined {
  if (names === undefined) return undefined
  return tableMessage('datatable.noRecordsIn', names, currentLang, languages)
}

/**
 * The view switcher a grid bound to a table that declares `views[]` draws: its
 * first entry's words, `All <plural>`. Nothing at all for a table that declares
 * none, nor for a system source.
 */
export function viewSwitcherProps(
  resolved: {
    readonly dataTableNames?: TableDisplayNames
    readonly dataTableDeclaresViews?: boolean
  },
  currentLang: string | undefined,
  languages: Languages | undefined
): { readonly viewSwitcher?: { readonly allLabel: string } } {
  const names = resolved.dataTableNames
  if (names === undefined || resolved.dataTableDeclaresViews !== true) return {}
  return {
    viewSwitcher: { allLabel: tableMessage('datatable.viewAll', names, currentLang, languages) },
  }
}

/** One `{table}` string, the table named by its plural label in the page language. */
function tableMessage(
  key: string,
  names: TableDisplayNames,
  currentLang: string | undefined,
  languages: Languages | undefined
): string {
  const lang = currentLang ?? DEFAULT_INTERPRETER_LANG
  const declared = names.labelPlural ?? names.label
  const table =
    declared === undefined
      ? humanizeFieldName(names.name)
      : resolveTranslationPattern(declared, lang, languages)
  return fillPlaceholders(resolveInterpreterString(key, lang, languages), { table })
}
