/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { humanizeFieldName } from '@/presentation/utils/string-utils'
import type { RecordButtonConfig } from '../../shared/record-button'
import type { FieldType } from '@/domain/models/app/tables/fields'

/**
 * A single conditional rule used by visibleWhen / requiredWhen / disabledWhen.
 * Mirrors the domain VisibleWhenCondition shape without importing from domain layer.
 */
export type ConditionRule =
  | {
      readonly field: string
      readonly operator: string
      readonly value?: string | number | boolean
    }
  | { readonly or: readonly ConditionRule[] }
  | { readonly and: readonly ConditionRule[] }

/**
 * Field definition consumed by the CRUD form island.
 *
 * Combines the table-schema info (name, type, required, options) with
 * per-field user overrides (displayLabel, placeholder, readOnly, defaultValue,
 * hidden) and editor-specific options (language, toolbar, etc.).
 */
export interface FieldDef {
  readonly name: string
  /**
   * The field's type discriminator, narrowed to the domain field-type union
   * so every dispatch over it can be made total (see
   * `@/presentation/utils/field-type-behavior`). The value is rehydrated from
   * a JSON blob at runtime, so consumers still route through the defensive
   * `fieldTypeBehavior()` accessor rather than indexing a record directly.
   */
  readonly type: FieldType
  readonly required?: boolean
  readonly options?: readonly string[]
  /**
   * The bound column's declared `format` (`barcode`). Carried into the island
   * because it decides whether an untouched empty value may be written at all
   * — a formatted column has a CHECK that `''` fails. See `omitsEmptyValue`.
   */
  readonly format?: string
  readonly language?: string
  readonly lineNumbers?: boolean
  readonly readOnly?: boolean
  readonly disabled?: boolean
  readonly tabSize?: number
  readonly minLines?: number
  readonly maxLines?: number
  readonly toolbar?: readonly string[]
  readonly placeholder?: string
  readonly maxLength?: number
  readonly displayLabel?: string
  /**
   * Author-written guidance rendered as persistent help text under the control
   * and linked to it by `aria-describedby` — unlike `placeholder`, which the
   * control loses on the first keystroke. Resolved server-side from the form
   * entry's `description` then the bound field's own; absent when neither
   * declares one, so no empty help-text node is emitted.
   */
  readonly description?: string
  readonly defaultValue?: string | number | boolean
  readonly hidden?: boolean
  readonly visibleWhen?: ConditionRule
  readonly requiredWhen?: ConditionRule
  readonly disabledWhen?: ConditionRule
  /** Storage bucket name used by the rich-text image button. */
  readonly imageBucket?: string
  /** Accepted file MIME types / extensions (single-attachment, multiple-attachments). */
  readonly accept?: string
  /** Render drag-and-drop zone for file upload fields. */
  readonly dropZone?: boolean
  /** Maximum number of files (multiple-attachments). */
  readonly maxFiles?: number
  /** Maximum file size in bytes (single-attachment, multiple-attachments). */
  readonly maxFileSize?: number
  /** Allowed MIME types for file upload fields (single-attachment, multiple-attachments). */
  readonly allowedFileTypes?: readonly string[]
  /**
   * Storage bucket DECLARED on the bound attachment column (single-attachment,
   * multiple-attachments). Uploads and previews target this bucket; when
   * omitted the field falls back to the implicit 'default' bucket..
   */
  readonly bucket?: string
  /**
   * Button-field config, present only on `type: 'button'` fields.
   *
   * Deliberately separate from this type's `visibleWhen`: that one is the
   * FORM's condition grammar (`{ field, operator, value }`) evaluated against
   * the form's current values, while the button carries the TABLE's grammar
   * (`{ field, eq, in, … }`) evaluated against a record. Folding them together
   * would silently reinterpret one as the other.
   */
  readonly button?: RecordButtonConfig
}

/** Resolve a field's display label: explicit override or humanized field name. */
export function labelOf(field: FieldDef): string {
  return field.displayLabel ?? humanizeFieldName(field.name)
}
