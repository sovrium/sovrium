/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable react-perf/jsx-no-new-function-as-prop --
   Cell-level editor: mounted per open cell, torn down on commit or cancel, and
   its handlers close over the draft selection. Memoizing them removes no
   re-render work, because toggling an option IS the state change. */

import { useState } from 'react'
import { optionColor, optionLabel, optionValue } from '@/domain/utils/select-option'
import { readsAsList } from '../../shared/cell-value-semantics'
import { editMetaOf, optionsOf, type CellEditorProps } from './editor-contract'
import { EditorPopover } from './editor-popover'
import { OptionListbox, type ListboxCandidate } from './option-listbox'
import type { ReactElement } from 'react'

/**
 * The `multi-select` cell editor.
 *
 * Writes an ARRAY. The text box this replaces rendered the set comma-joined and
 * wrote that string straight back, so a value that merely LOOKED unchanged in
 * the cell had already stopped being a set in the column — `text[]` on
 * PostgreSQL, and a membership CHECK on each entry.
 *
 * Options carry the author's declared colours ([internal ref] A7): the vocabulary here
 * belongs to whoever wrote the schema, so the chips honour it. That is the same
 * reason a `rating` does NOT get a colour — its schema has `max` and `style`,
 * and `style` picks a glyph, never a hue.
 *
 * Each pick COMMITS. A staged model would need a confirm affordance in a
 * one-line cell, and the grid's existing select editor already commits on
 * change — two option controls in one grid disagreeing about when a click
 * counts is exactly the drift this story is undoing.
 */
export function MultiSelectEditor(props: CellEditorProps): ReactElement {
  const { value, commit, cancel, tabNext, fieldMeta, fieldName } = props
  const [selected, setSelected] = useState<readonly string[]>(() => readsAsList(value))

  const declared = optionsOf(fieldMeta)
  const candidates: readonly ListboxCandidate[] = declared.map((option) => {
    const color = optionColor(option)
    return {
      value: optionValue(option),
      label: optionLabel(option),
      ...(color ? { color } : {}),
    }
  })

  const toggle = (optionKey: string): void => {
    const next = selected.includes(optionKey)
      ? selected.filter((entry) => entry !== optionKey)
      : [...selected, optionKey]
    setSelected(next)
    commit(next)
  }

  return (
    <EditorPopover
      label={`Edit ${fieldName ?? 'value'}`}
      cancel={cancel}
      tabValue={() => selected}
      {...(tabNext && { tabNext })}
    >
      <div className="absolute top-0 left-0 z-20">
        <OptionListbox
          candidates={candidates}
          selected={selected}
          onToggle={toggle}
          multiple={true}
          ariaLabel={fieldName ?? 'Options'}
          emptyLabel={
            editMetaOf(fieldMeta).placeholder ?? 'This field declares no options to choose from'
          }
        />
      </div>
    </EditorPopover>
  )
}
