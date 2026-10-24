/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type FieldDef } from './field-def'
import { isLinkList } from './record-picker-value'
import { loadedMarkOf } from './wire-values'

/**
 * Beside each link list of a natively posted edit, the ids its picker was
 * filled with (`_loaded:<field>`): the server leaves a list still holding them
 * out of the save, so a link made meanwhile, elsewhere, is not taken off by it.
 */
export function LoadedLinkLists(props: {
  readonly fields: readonly FieldDef[]
  readonly loaded: Readonly<Record<string, string>> | undefined
}) {
  return props.fields.filter(isLinkList).map((field) => (
    <input
      key={field.name}
      type="hidden"
      name={loadedMarkOf(field.name)}
      value={props.loaded?.[field.name] ?? ''}
    />
  ))
}
