/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { humanizeFieldName } from '@/presentation/design/string-utils'
import type { RecordButtonConfig } from '../../runtime/record-button'
import type { FieldType } from '@/domain/models/app/tables/fields'
import type {
  ChoiceOption,
  TypedColumnConfig,
} from '@/presentation/design/field-control-attributes'

/**
 * Field definition consumed by the CRUD form island.
 *
 * Combines the table-schema info (name, type, required, options) with
 * per-field user overrides (displayLabel, placeholder, readOnly, defaultValue,
 * hidden) and editor-specific options (language, toolbar, etc.).
 */
export interface FieldDef extends TypedColumnConfig {
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
  /** A choice field's options: the stored `value` and the `label` the control offers. */
  readonly options?: readonly ChoiceOption[]
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
  /** Storage bucket name used by the rich-text image button. */
  readonly imageBucket?: string
  /** Maximum file size in bytes (single-attachment, multiple-attachments). */
  readonly maxFileSize?: number
  /** Allowed MIME types for file upload fields (single-attachment, multiple-attachments). */
  readonly allowedFileTypes?: readonly string[]
  /**
   * Storage bucket DECLARED on the bound attachment column (single-attachment,
   * multiple-attachments). Uploads and previews target this bucket; when
   * omitted the field falls back to the built-in `system` bucket.
   */
  readonly bucket?: string
  /**
   * Button-field config, present only on `type: 'button'` fields.
   *
   * Its `visibleWhen` is the TABLE's condition grammar (`{ field, eq, in, … }`),
   * evaluated against a record.
   */
  readonly button?: RecordButtonConfig
  // ── relationship (record picker) pass-throughs ─────────────────────────
  //
  // Resolved off the bound `relationship` column so the form can render the
  // SAME searchable picker the grid's cell editor already renders. Before
  // [internal ref] none of these reached the client and the control degraded to a
  // free-text box asking for a raw foreign key.
  /** The table the picker searches. */
  readonly relatedTable?: string
  /** The column the picker searches on and labels candidates by. */
  readonly displayField?: string
  /** `many-to-one` / `one-to-many` / `many-to-many`. */
  readonly relationType?: string
  /** Whether the field holds a LIST of links rather than one. */
  readonly allowMultiple?: boolean
  /** Ceiling on how many records the field may link to. */
  readonly maxLinked?: number
  //
  // `allowCreate` and `canCreateRelated` are deliberately ABSENT from this
  // surface — a plain comment rather than a JSDoc block, because a JSDoc
  // documents the member that FOLLOWS it and there is no member here.
  //
  // Inline create is live on the GRID picker, where the session-scoped
  // permission gate that decides whether the affordance may even be drawn is
  // resolved; forwarding the flag here without that gate would draw a create
  // affordance for a role that cannot create, which is the enumeration leak the
  // gate exists to prevent.
}

/** Resolve a field's display label: explicit override or humanized field name. */
export function labelOf(field: FieldDef): string {
  return field.displayLabel ?? humanizeFieldName(field.name)
}
