/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { humanizeFieldName } from '@/presentation/utils/string-utils'

export type ConditionRule =
  | {
      readonly field: string
      readonly operator: string
      readonly value?: string | number | boolean
    }
  | { readonly or: readonly ConditionRule[] }
  | { readonly and: readonly ConditionRule[] }

export interface FieldDef {
  readonly name: string
  readonly type: string
  readonly required?: boolean
  readonly options?: readonly string[]
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
  readonly defaultValue?: string | number | boolean
  readonly hidden?: boolean
  readonly visibleWhen?: ConditionRule
  readonly requiredWhen?: ConditionRule
  readonly disabledWhen?: ConditionRule
  readonly imageBucket?: string
  readonly accept?: string
  readonly dropZone?: boolean
  readonly maxFiles?: number
  readonly maxFileSize?: number
  readonly allowedFileTypes?: readonly string[]
}

export function labelOf(field: FieldDef): string {
  return field.displayLabel ?? humanizeFieldName(field.name)
}
