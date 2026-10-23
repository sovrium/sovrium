/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createContext, useContext } from 'react'
import type { RecordDrawerField } from '../../overlays/record-drawer-field'

/**
 * What a grid declaring `rowExpand.placement: inline` receives from the server:
 * the record the panel would show — its fields as the reader may see them, its
 * `canEdit`, `title` and words — and whether one row open closes the others.
 */
export interface InlineExpandConfig {
  readonly title?: string
  readonly recordFields: ReadonlyArray<RecordDrawerField>
  readonly canEdit: boolean
  readonly saveLabel: string
  readonly savingLabel?: string
  readonly actionStrings?: Readonly<Record<string, string>>
  /** The toggle's accessible name, in the page language. */
  readonly toggleLabel: string
  readonly single: boolean
}

export interface InlineExpandState {
  readonly config: InlineExpandConfig
  readonly table: string | undefined
  readonly isExpanded: (rowId: string) => boolean
  readonly toggle: (rowId: string) => void
}

export const InlineExpandContext = createContext<InlineExpandState | undefined>(undefined)

/** The grid's inline expand, when it declares one: `undefined` for every other grid. */
export const useInlineExpand = (): InlineExpandState | undefined => useContext(InlineExpandContext)
