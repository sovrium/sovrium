/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * An operator table as the console draws it for one caller: in finished words
 * (`withReadableTableLabels`), and marked read-only when her role may not
 * change its records.
 *
 * The console renders without a session, so the record sheet it draws cannot
 * ask the table's update rule itself; the mount, which holds the session,
 * answers it here with the rule the records API applies
 * (`hasUpdatePermission`), and the sheet reads the mark
 * ({@link CALLER_READ_ONLY_KEY}). A sheet that offered Save to a reader the
 * API refuses would be painting a control the backend turns down.
 */

import { toGroupReference } from './groups/group-reference'
import { hasUpdatePermission } from './permission-evaluator-service'
import { withReadableTableLabels, type LabelTranslator } from './readable-name-service'
import type { SessionInfo } from './session-info'

/** The render-time-only key a table is marked with when its console caller may not change it. */
export const CALLER_READ_ONLY_KEY = '_callerReadOnly'

/**
 * The render-time-only key a table carries its fields' labels under, by field
 * name, in every language the app declares — read before the view turns each
 * label into finished text in one language, which would leave the console's
 * import nothing to match a header written in another.
 */
export const IMPORT_FIELD_LABELS_KEY = '_importFieldLabels'

/**
 * The render-time-only key a table carries its choice fields' option labels
 * under — by field name, then by option value, in every language the app
 * declares — for the same reason: a spreadsheet may spell an option by its
 * label in a language the console is not read in.
 */
export const IMPORT_OPTION_LABELS_KEY = '_importOptionLabels'

/** Each option's labels in every language, by option value, by field name. */
export type OptionLabelCandidates = Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
>

/** The slice of a table this view reads and returns. */
type ConsoleTable = Parameters<typeof withReadableTableLabels>[0] &
  Parameters<typeof hasUpdatePermission>[0] & { readonly name: string }

/**
 * The table in readable words, marked {@link CALLER_READ_ONLY_KEY} when the
 * caller — or no caller at all — may not update its records.
 */
export const consoleTableView = <T extends ConsoleTable>(
  table: T,
  caller: {
    readonly session: SessionInfo | undefined
    readonly tables: Parameters<typeof hasUpdatePermission>[2]
    readonly translate: LabelTranslator
    /** One translator per language the app declares; absent, no labels are carried. */
    readonly labelsIn?: ReadonlyArray<LabelTranslator>
  }
): T => {
  const labels = fieldLabelsInEveryLanguage(table, caller.labelsIn ?? [])
  const optionLabels = optionLabelsInEveryLanguage(table.fields ?? [], caller.labelsIn ?? [])
  const labelled = {
    ...withReadableTableLabels(table, caller.translate),
    ...(Object.keys(labels).length === 0 ? {} : { [IMPORT_FIELD_LABELS_KEY]: labels }),
    ...(Object.keys(optionLabels).length === 0 ? {} : { [IMPORT_OPTION_LABELS_KEY]: optionLabels }),
  }
  const { session } = caller
  const groups = (session?.groups ?? []).map(toGroupReference)
  const mayUpdate =
    session !== undefined && hasUpdatePermission(table, session.role, caller.tables, groups)
  return mayUpdate ? labelled : { ...labelled, [CALLER_READ_ONLY_KEY]: true }
}

/**
 * Each field's DECLARED label in every language `labelsIn` reads, deduplicated,
 * by field name. A field declaring no label is left out (its name is matched
 * already), and so is a translation the app does not hold.
 */
const fieldLabelsInEveryLanguage = (
  table: ConsoleTable,
  labelsIn: ReadonlyArray<LabelTranslator>
): Readonly<Record<string, readonly string[]>> =>
  Object.fromEntries(
    (table.fields ?? []).flatMap(({ name, label }) => {
      if (label === undefined || label.trim() === '') return []
      const candidates = [...new Set(labelsIn.map((translate) => translate(label)))].filter(
        (candidate) => candidate.trim() !== '' && !candidate.startsWith('$t:')
      )
      return candidates.length === 0 ? [] : [[name, candidates]]
    })
  )

/** The labels `labelsIn` reads `label` as, deduplicated, without a translation the app does not hold. */
const labelInEveryLanguage = (
  label: string,
  labelsIn: ReadonlyArray<LabelTranslator>
): readonly string[] =>
  [...new Set(labelsIn.map((translate) => translate(label)))].filter(
    (candidate) => candidate.trim() !== '' && !candidate.startsWith('$t:')
  )

/** The `{ value, label }` options a field declares with a label; a bare-string option has none. */
const labelledOptions = (
  field: unknown
): ReadonlyArray<{ readonly value: string; readonly label: string }> => {
  const { options } = field as { readonly options?: unknown }
  if (!Array.isArray(options)) return []
  return options.flatMap((option: unknown) => {
    const { value, label } = (option ?? {}) as {
      readonly value?: unknown
      readonly label?: unknown
    }
    return typeof value === 'string' && typeof label === 'string' && label.trim() !== ''
      ? [{ value, label }]
      : []
  })
}

/**
 * Each field's option labels in every language `labelsIn` reads, by option
 * value, by field name. An option declaring no label is left out (its value is
 * matched already), and so is a field none of whose options declares one.
 */
export const optionLabelsInEveryLanguage = (
  fields: ReadonlyArray<unknown>,
  labelsIn: ReadonlyArray<LabelTranslator>
): OptionLabelCandidates =>
  Object.fromEntries(
    fields.flatMap((field) => {
      const { name } = field as { readonly name?: unknown }
      if (typeof name !== 'string') return []
      const byValue = labelledOptions(field).flatMap(({ value, label }) => {
        const candidates = labelInEveryLanguage(label, labelsIn)
        return candidates.length === 0 ? [] : [[value, candidates] as const]
      })
      return byValue.length === 0 ? [] : [[name, Object.fromEntries(byValue)]]
    })
  )
