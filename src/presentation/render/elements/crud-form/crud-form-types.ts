/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Languages } from '@/domain/models/app/languages'
import type { VisibleWhenCondition } from '@/domain/models/app/pages/components/component-types/data/form'
import type { FieldType } from '@/domain/models/app/tables/fields'

/**
 * A success-page action button (`reset` or `navigate`). Mirrors the
 * `SuccessPageAction` domain shape.
 */
export type SuccessPageActionConfig = {
  readonly label: string
  readonly action: 'reset' | 'navigate'
  readonly url?: string
}

/** Per-field label/placeholder override declared on a CRUD action. */
export type CrudFieldOverride = {
  readonly name: string
  readonly label?: string
  readonly placeholder?: string
}

/**
 * CRUD action shape for form rendering
 */
export type CrudFormAction = {
  readonly type: string
  readonly operation: string
  readonly table: string
  /** Custom submit-button label (supports `$t:key`). Overrides the built-in. */
  readonly submitLabel?: string
  /** Per-field label/placeholder overrides (each supports `$t:key`). */
  readonly fields?: readonly CrudFieldOverride[]
  readonly onSuccess?: {
    readonly type?: string
    readonly navigate?: string
    readonly preserveFields?: readonly string[]
    readonly title?: string
    readonly message?: string
    readonly actions?: readonly SuccessPageActionConfig[]
    readonly showSummary?: boolean
    readonly redirect?: string
    readonly toast?: {
      readonly message: string
      readonly variant?: string
      readonly duration?: number
    }
  }
  readonly confirm?: boolean
  readonly confirmMessage?: string
}

/**
 * Resolved field definition combining table schema info with per-field user config.
 *
 * Includes a `displayLabel` (humanized or user-overridden) and per-field flags
 * like `placeholder`, `readOnly`, `defaultValue`, and `hidden` from `fields[]`.
 */
export type ResolvedFieldDef = {
  readonly name: string
  /** Narrowed to the domain field-type union so every dispatch over it is total. */
  readonly type: FieldType
  readonly required?: boolean
  /** Choice-field option VALUES, already unwrapped from `status`'s `{ value, color }` objects. */
  readonly options?: readonly string[]
  /**
   * The bound column's declared `format` (`barcode`). Forwarded to the island
   * because it decides whether an untouched empty value may be written at all
   * — a formatted column carries a CHECK that `''` fails.
   */
  readonly format?: string
  readonly displayLabel: string
  /**
   * Author-written guidance rendered as persistent help text under the control
   * and linked to it by `aria-describedby`. Resolved from the form entry's
   * `description`, then the bound field's own; absent when neither declares one,
   * so no empty help-text node is emitted.
   */
  readonly description?: string
  readonly placeholder?: string
  readonly readOnly?: boolean
  readonly disabled?: boolean
  readonly defaultValue?: string | number | boolean
  readonly hidden?: boolean
  readonly visibleWhen?: VisibleWhenCondition
  readonly requiredWhen?: VisibleWhenCondition
  readonly disabledWhen?: VisibleWhenCondition
  // ── rich-text / code editor pass-throughs ──────────────────────────────
  /** Maximum character count (rich-text). Forwarded to the editor character-count plugin. */
  readonly maxLength?: number
  /** Toolbar action tokens (rich-text). Drives which toolbar buttons render. */
  readonly toolbar?: readonly string[]
  /** Storage bucket name used by the rich-text image button. Resolved from `app.buckets`. */
  readonly imageBucket?: string
  /** Code-editor language (code field). */
  readonly language?: string
  /** Code-editor lineNumbers toggle. */
  readonly lineNumbers?: boolean
  /** Code-editor tab size. */
  readonly tabSize?: number
  /** Code-editor minimum visible lines. */
  readonly minLines?: number
  /** Code-editor maximum visible lines. */
  readonly maxLines?: number
  // ── file upload pass-throughs ──────────────────────────────────────────
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
   * Storage bucket DECLARED on the bound attachment column. Uploads and
   * previews target this bucket; omitted when the column declares none, in
   * which case the field falls back to the implicit 'default'..
   */
  readonly bucket?: string
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
  /**
   * `allowCreate` and `canCreateRelated` are deliberately ABSENT from this
   * surface. Inline create is live on the GRID picker, where the session-scoped
   * permission gate that decides whether the affordance may even be drawn is
   * resolved; forwarding the flag here without that gate would draw a create
   * affordance for a role that cannot create, which is the enumeration leak the
   * gate exists to prevent.
   */
}

/**
 * Bundle of the active page language + app translations threaded from the
 * section renderer so the CRUD renderer can resolve `$t:key` submit/field-label
 * references server-side. Mirrors `AuthFormRenderContext`. Bundled into one
 * object so the renderer signature stays under the ESLint `max-params` ceiling.
 */
export interface CrudFormRenderContext {
  readonly lang?: string
  readonly languages?: Languages
}
