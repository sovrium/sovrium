/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Field-type → read-only cell renderer dispatch map.
 *
 * Separate from `./cell-renderers.tsx` so that the React component module
 * exports only components (satisfies the fast-refresh `only-export-components`
 * rule). The 4 user-field aliases (`user`, `created-by`, `updated-by`,
 * `deleted-by`) all dispatch to `UserPillCell` since they share the same
 * visual identity.
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
import {
  AttachmentLinkCell,
  AttachmentListCell,
  BarcodeCell,
  CheckboxCell,
  ColorSwatchCell,
  DateTimeCell,
  DurationCell,
  ProgressCell,
  RatingCell,
  RichTextPreviewCell,
} from './scalar-cell-renderers'

/**
 * Field-types that this module owns the read-only chrome for. The mapping is
 * stable: each schema field-type literal maps to exactly one renderer.
 */
export const FIELD_TYPE_TO_CELL_RENDERER: Readonly<Record<string, CellRenderer>> = {
  // User-field aliases (4 schemas, 1 visual)
  user: UserPillCell,
  'created-by': UserPillCell,
  'updated-by': UserPillCell,
  'deleted-by': UserPillCell,
  // Relational field-types (3 schemas, 1 visual)
  relationship: LinkedRecordPillCell,
  lookup: LinkedRecordPillCell,
  rollup: LinkedRecordPillCell,
  // Selection (3 schemas, 2 visuals — one chip for a single chosen value, a
  // chip wrap for many). `single-select` and `multi-select` had NO entry here
  // at all and fell through to TanStack's `String(value)` default, so a
  // multi-select cell rendered `a,b` as raw text while `status` — the same
  // grammar — rendered a pill.
  status: StatusPillCell,
  'single-select': StatusPillCell,
  'multi-select': ArrayChipsCell,
  // Advanced field-types (5 distinct visuals)
  formula: FormulaReadonlyCell,
  geolocation: GeolocationCell,
  count: CountBadgeCell,
  json: JsonPreviewCell,
  array: ArrayChipsCell,
  code: CodeInlineCell,
  // Scalar field-types (8 schemas, 8 visuals — `./scalar-cell-renderers.tsx`).
  // Every one of these had NO entry here either, so a rating rendered `3`, a
  // progress field `72`, a color field the literal text `#3B82F6`, a checkbox
  // the word `false`, and an attachment `[object Object]`.
  rating: RatingCell,
  progress: ProgressCell,
  color: ColorSwatchCell,
  barcode: BarcodeCell,
  duration: DurationCell,
  checkbox: CheckboxCell,
  'single-attachment': AttachmentLinkCell,
  'multiple-attachments': AttachmentListCell,
  // Temporal and prose field-types that also had no entry: a `datetime` cell
  // showed the raw ISO instant the API sends, and a `rich-text` cell showed its
  // own markup spelled out, because React escapes the stored body.
  datetime: DateTimeCell,
  'rich-text': RichTextPreviewCell,
}
