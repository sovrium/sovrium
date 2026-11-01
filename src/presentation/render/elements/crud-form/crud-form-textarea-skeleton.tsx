/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { fieldWidgetOf } from '@/presentation/design/field-type-behavior'
import { CrudFieldShell } from './crud-field-shell'
import { controlStateAttributes } from './crud-form-typed-input'
import type { SkeletonFieldDef } from './crud-form-skeleton'

/** A `long-text` column, or a text column its author drew with `control: textarea`. */
export function isMultiLineField(field: SkeletonFieldDef): boolean {
  return field.control === 'textarea' || fieldWidgetOf(field.type) === 'textarea'
}

/**
 * The skeleton of a multi-line box: a real `<textarea>`, never a text input.
 *
 * A browser strips every line break from a text input's value, so a one-line
 * placeholder handed the island (which takes a value captured before its mount
 * over the record's) and a script-less save the flattened text, and saving any
 * other field wrote it back. A textarea keeps the lines in both cases.
 */
export function renderTextareaSkeleton(field: SkeletonFieldDef, value: string): ReactElement {
  return (
    <CrudFieldShell
      key={field.name}
      field={field}
    >
      <textarea
        name={field.name}
        defaultValue={value}
        {...controlStateAttributes(field)}
      />
    </CrudFieldShell>
  )
}
