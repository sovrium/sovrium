/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { PlainSelect } from './plain-select'
import { SearchableSelect } from './searchable-select'
import type { SelectIslandProps } from './select-island-types'
import type { ReactElement } from 'react'

/**
 * TODO(escp/forms): selection state is client-only — `onValueChange` is
 * not wired into form state. F-1 (form trigger) and Phase D (top-level
 * `forms[]`) will need to hand the selected value to the surrounding
 * form via a hidden input or controlled binding. Tracked at the schema
 * level by `name`/`value` pairs in form-control schemas.
 */

/**
 * Select island — wraps Base UI Select for custom dropdown selection.
 *
 * Replaces native `<select>` with floating positioning, keyboard navigation,
 * custom option rendering, and theme-aware styling via data attributes.
 *
 * When `searchable: true`, switches to Base UI Combobox primitives, which
 * provide built-in type-ahead filtering — Base UI's plain Select supports
 * only basic keyboard typeahead (no list filtering).
 */
export default function SelectIsland(props: SelectIslandProps): ReactElement {
  return props.searchable ? <SearchableSelect {...props} /> : <PlainSelect {...props} />
}
