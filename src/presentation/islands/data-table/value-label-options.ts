/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  optionColor,
  optionValue,
  type SelectOptionLike,
} from '@/domain/models/app/tables/select-option'
import type { CellFieldOptions } from './cell-renderers'

/**
 * A column's `valueLabels` folded into the options its chips are drawn from,
 * so a relabelled value keeps its option's chip and colour and only its words
 * change. A value the map leaves out keeps its option's own label; a mapped
 * value no option declares is added as a chip without a colour.
 *
 * `undefined` when the column has no map or the field no options: the cell then
 * takes the plain-text relabel path, as every column without chips does.
 */
export function withValueLabelOptions(
  fieldOptions: CellFieldOptions,
  valueLabels: Readonly<Record<string, string>> | undefined
): CellFieldOptions | undefined {
  const declared = fieldOptions.selectOptions
  if (valueLabels === undefined || declared === undefined) return undefined
  const relabel = (option: SelectOptionLike): SelectOptionLike => {
    const label = valueLabels[optionValue(option)]
    if (label === undefined) return option
    const color = optionColor(option)
    return { value: optionValue(option), label, ...(color === undefined ? {} : { color }) }
  }
  const known = new Set(declared.map(optionValue))
  const extras = Object.entries(valueLabels)
    .filter(([value]) => !known.has(value))
    .map(([value, label]) => ({ value, label }))
  return { ...fieldOptions, selectOptions: [...declared.map(relabel), ...extras] }
}
