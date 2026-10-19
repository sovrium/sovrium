/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { EDIT_SELECT_CURRENT_KEY } from '@/presentation/render/resolve/edit-select-record'
import type { Languages } from '@/domain/models/app/languages'
import type { EditSelect } from '@/domain/models/app/pages/components/component-types/data/table/columns'

/**
 * The attribute a picker button carries its picker on, read by the client
 * runtime (`islands/runtime/fetch-button-runtime.ts`), which opens the menu
 * instead of sending the action at once.
 */
const EDIT_SELECT_ATTR = 'data-edit-select'

/** What the client needs to draw and commit a picker: the editor, its record's value, its words. */
interface EditSelectPayload {
  readonly field: string
  readonly label: string
  readonly options: readonly { readonly value: string; readonly label?: string }[]
  readonly multiple?: boolean
  readonly saveLabel: string
  /** The record's current value of `field`: a list with `multiple`, else one value. */
  readonly current: unknown
}

/**
 * The picker attributes of a `button` carrying `editSelect` over a `fetch`
 * action, or none — the client opens a picker only before a fetch.
 *
 * The whole editor rides in one JSON attribute, as the fetch action beside it
 * does, with the record's current value the substitution kept on the node
 * (`resolve/edit-select-record.ts`) and the commit item's words resolved in the
 * page language when the author named none. `aria-haspopup` tells a screen
 * reader the press opens a menu rather than acting.
 *
 * Its `optionsSource` has been replaced by `options` before the page renders
 * (`resolve/select-option-source-resolver.ts`).
 */
export function buildEditSelectAttributes(
  action: unknown,
  component: Readonly<Record<string, unknown>> | undefined,
  lang: { readonly currentLang?: string; readonly languages?: Languages } | undefined
): Record<string, string> {
  const editSelect = component?.['editSelect'] as EditSelect | undefined
  if (editSelect === undefined || (action as { type?: unknown })?.type !== 'fetch') return {}
  const saveLabel = resolveInterpreterString('datatable.save', lang?.currentLang, lang?.languages)
  return {
    [EDIT_SELECT_ATTR]: JSON.stringify(
      pickerPayload(editSelect, component?.[EDIT_SELECT_CURRENT_KEY], saveLabel)
    ),
    'aria-haspopup': 'menu',
    'aria-expanded': 'false',
  }
}

/** The picker as the client reads it; `defaultSave` names the commit item no author named. */
const pickerPayload = (
  editSelect: EditSelect,
  current: unknown,
  defaultSave: string
): EditSelectPayload => ({
  field: editSelect.field,
  label: editSelect.label,
  options: editSelect.options ?? [],
  ...(editSelect.multiple === true && { multiple: true }),
  saveLabel: editSelect.saveLabel ?? defaultSave,
  current: current ?? null,
})
