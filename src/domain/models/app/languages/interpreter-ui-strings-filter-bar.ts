/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The interpreter strings of the `filter-bar`: its add control, the condition
 * builder it opens, the operator words (a comparison's key carries its field
 * kind, `date.gt` "is after"), the relative `within` windows and the chips.
 * Part of {@link INTERPRETER_UI_STRINGS}, which spreads this table in; kept
 * apart only so neither file outgrows its ceiling. English is today's literal,
 * French is built in, and an author renames any key under `sovrium.<key>`.
 */
export const FILTER_BAR_UI_STRINGS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  /** The add control and the condition builder it opens. */
  'filterBar.addFilter': { en: 'Add filter', fr: 'Ajouter un filtre' },
  /** A chip's remove button; `{field}` is the filtered field's label. */
  'filterBar.removeFilter': { en: 'Remove {field} filter', fr: 'Retirer le filtre {field}' },
  /** An operator's words; a comparison's key carries its field kind (`date.gt` "is after"). */
  'filterBar.operator.eq': { en: 'is', fr: 'est' },
  'filterBar.operator.neq': { en: 'is not', fr: 'n’est pas' },
  'filterBar.operator.contains': { en: 'contains', fr: 'contient' },
  'filterBar.operator.startsWith': { en: 'starts with', fr: 'commence par' },
  'filterBar.operator.in': { en: 'is any of', fr: 'est l’un de' },
  'filterBar.operator.between': { en: 'is between', fr: 'est entre' },
  'filterBar.operator.within': { en: 'is within', fr: 'est dans' },
  'filterBar.within.past-7d': { en: 'the last 7 days', fr: 'les 7 derniers jours' },
  'filterBar.within.past-30d': { en: 'the last 30 days', fr: 'les 30 derniers jours' },
  'filterBar.within.next-7d': { en: 'the next 7 days', fr: 'les 7 prochains jours' },
  'filterBar.operator.number.gt': { en: 'is greater than', fr: 'est supérieur à' },
  'filterBar.operator.number.lt': { en: 'is less than', fr: 'est inférieur à' },
  'filterBar.operator.number.gte': { en: 'is at least', fr: 'est au moins' },
  'filterBar.operator.number.lte': { en: 'is at most', fr: 'est au plus' },
  'filterBar.operator.date.gt': { en: 'is after', fr: 'est après le' },
  'filterBar.operator.date.lt': { en: 'is before', fr: 'est avant le' },
  'filterBar.operator.date.gte': { en: 'is on or after', fr: 'est à partir du' },
  'filterBar.operator.date.lte': { en: 'is on or before', fr: 'est jusqu’au' },
  /** A `between` chip's value, and the names of the builder's two ends. */
  'filterBar.range': { en: '{from} and {to}', fr: '{from} et {to}' },
  'filterBar.from': { en: 'From', fr: 'De' },
  'filterBar.to': { en: 'To', fr: 'À' },
  /** The builder's commit, and its value control's name; `{field}` is the field's label. */
  'filterBar.apply': { en: 'Apply', fr: 'Appliquer' },
  'filterBar.value': { en: '{field} value', fr: 'Valeur de {field}' },
}
