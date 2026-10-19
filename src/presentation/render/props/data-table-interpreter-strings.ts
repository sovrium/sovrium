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
 * The grid's own words — its toolbar, pager, notices, fill handle and editors
 * (`datatable.*`), the rate-limited read, the selection bar's confirmation,
 * the shared filter — and the words of what it opens: its pickers (`picker.*`)
 * and a rich-text cell's toolbar (`richText.*`). The new row refuses an empty
 * required column with the form's own sentence (`form.requiredNamed`).
 */
const GRID_STRING_PREFIXES = [
  'datatable.',
  'rateLimit.',
  'confirmGate.',
  'sharedFilter.',
  'picker.',
  'richText.',
  'form.requiredNamed',
]

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
      [...GRID_STRING_PREFIXES, ...ROW_ACTION_PENDING_KEYS],
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
 * What a grid says when its read failed, and when the read was answered 404,
 * naming WHICH grid failed: a grid bound to a table names the table, as its
 * empty state does; a grid bound to no table (a system source) names itself by
 * its accessible name, the `aria-label` its author already wrote for a screen
 * reader, in the page language. `undefined` for a grid with neither, which
 * keeps the generic sentences — there is no name to give.
 */
export function gridReadFailure(args: {
  readonly resolved: { readonly dataTableNames?: TableDisplayNames }
  readonly baseElementPropsWithType: Readonly<Record<string, unknown>>
  readonly currentLang?: string
  readonly languages?: Languages
}): { readonly loadFailed: string; readonly notFound: string } | undefined {
  const { resolved, baseElementPropsWithType, currentLang, languages } = args
  const lang = currentLang ?? DEFAULT_INTERPRETER_LANG
  const names = resolved.dataTableNames
  const ariaLabel = baseElementPropsWithType['aria-label']
  const table =
    names !== undefined
      ? tableName(names, lang, languages)
      : typeof ariaLabel === 'string' && ariaLabel.trim() !== ''
        ? resolveTranslationPattern(ariaLabel, lang, languages)
        : undefined
  if (table === undefined) return undefined
  return {
    loadFailed: fillPlaceholders(
      resolveInterpreterString('datatable.loadFailedIn', lang, languages),
      {
        table,
      }
    ),
    notFound: fillPlaceholders(resolveInterpreterString('datatable.notFoundIn', lang, languages), {
      table,
    }),
  }
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
  const table = tableName(names, lang, languages)
  return fillPlaceholders(resolveInterpreterString(key, lang, languages), { table })
}

/** A table's name for a sentence: its plural label, else its label, else its name made readable. */
function tableName(names: TableDisplayNames, lang: string, languages: Languages | undefined) {
  const declared = names.labelPlural ?? names.label
  return declared === undefined
    ? humanizeFieldName(names.name)
    : resolveTranslationPattern(declared, lang, languages)
}
