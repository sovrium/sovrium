/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { DrawerChoice } from './record-drawer-choices'
import type { RecordButtonConfig } from '../runtime/record-button'
import type { CurrencyDisplayOptions } from '@/domain/kernel/format/currency-format'
import type { OptionChipPaint } from '@/presentation/design/option-chip-paint'

/** A schema-derived field the drawer renders a control (or structured block) for. */
export interface RecordDrawerField {
  readonly name: string
  readonly type: string
  /**
   * The entry's display name, already resolved server-side (the per-entry
   * override, then the bound field's `label`). Absent means the drawer keeps its
   * raw-`name` fallback — deliberately RAW, never humanized.
   */
  readonly label?: string
  /** Guidance rendered beside the entry's value, already resolved server-side. */
  readonly description?: string
  /**
   * The bound column's declared currency display, when it has one — a
   * read-only entry prints its amount the way the grid cell does.
   */
  readonly currency?: CurrencyDisplayOptions
  /** Structured-display selector (CAP-3). Non-`text` renders a read-only block. */
  readonly renderAs?: 'text' | 'json' | 'list' | 'key-value' | 'code'
  /**
   * Button-field config, present only on `type: 'button'` fields. The drawer
   * holds the loaded record, so a button here gets the full behaviour: its
   * `visibleWhen` predicate and, for an automation button, a row to run on.
   */
  readonly button?: RecordButtonConfig
  /**
   * A `single-select` / `status` field's declared options, resolved by the SSR
   * host, so an editable drawer offers them as a choice the way the form does.
   */
  readonly options?: ReadonlyArray<DrawerChoice>
  /** A date / datetime column's `weekday`, printed before the date it reads. */
  readonly weekday?: 'short' | 'long'
  /** A datetime column's own `timeZone`, read before the operator zone. */
  readonly timeZone?: string
  /**
   * A `single-select` / `status` field's `value → paint` map, resolved by the
   * SSR host as the grid's pill paints it, so a read-only entry draws the
   * grid's badge. Only options declaring a colour are listed.
   */
  readonly paints?: Readonly<Record<string, OptionChipPaint>>
  /** An attachment column's upload bucket and constraints, for the editable file picker. */
  readonly bucket?: string
  readonly allowedFileTypes?: readonly string[]
  readonly maxFileSize?: number
  /**
   * A single-valued `relationship`'s related table and `displayField`, resolved
   * by the SSR host, so an editable drawer offers the link as a picker of named
   * records the way the form does.
   */
  readonly relatedTable?: string
  readonly displayField?: string
  /**
   * The bound column must hold a value: Save refuses it blank, and an optional
   * link offers a Clear control.
   */
  readonly required?: boolean
  /** The words a blank required entry is refused with, in the page language. */
  readonly requiredMessage?: string
  /**
   * The reader's role may not write this field: drawn as its value without an
   * editable control, and never sent by Save.
   */
  readonly readOnly?: boolean
  /** An optional link's Clear control, caption and accessible name, in the page language. */
  readonly clearLabel?: string
  readonly clearName?: string
}

export type Values = Record<string, string>
export type RawRecord = Record<string, unknown>

/** Whether a field renders as a read-only structured block (CAP-3) vs an editable input. */
export function isStructured(field: RecordDrawerField): boolean {
  return field.renderAs !== undefined && field.renderAs !== 'text'
}
