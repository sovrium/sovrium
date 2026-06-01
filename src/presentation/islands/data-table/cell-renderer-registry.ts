/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import {
  ArrayChipsCell,
  CodeInlineCell,
  CountBadgeCell,
  FormulaReadonlyCell,
  GeolocationCell,
  JsonPreviewCell,
  LinkedRecordPillCell,
  StatusPillCell,
  UserPillCell,
  type CellRenderer,
} from './cell-renderers'

export const FIELD_TYPE_TO_CELL_RENDERER: Readonly<Record<string, CellRenderer>> = {
  user: UserPillCell,
  'created-by': UserPillCell,
  'updated-by': UserPillCell,
  'deleted-by': UserPillCell,
  relationship: LinkedRecordPillCell,
  lookup: LinkedRecordPillCell,
  rollup: LinkedRecordPillCell,
  status: StatusPillCell,
  formula: FormulaReadonlyCell,
  geolocation: GeolocationCell,
  count: CountBadgeCell,
  json: JsonPreviewCell,
  array: ArrayChipsCell,
  code: CodeInlineCell,
}
