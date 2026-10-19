/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { fieldDescribedBy } from '@/presentation/design/field-display'
import { ChoiceSelectSkeleton, DateBoxSkeleton } from '../form-control-skeletons'
import { CrudFieldShell } from './crud-field-shell'
import { inputValueOf } from './crud-form-typed-input'
import type { SkeletonFieldDef } from './crud-form-skeleton'
import type { ReactElement } from 'react'

/**
 * The table-bound form's skeletons for the two controls the design system
 * draws — a choice, as the Select, and a date, as the date picker — painted
 * as the `crud-form` island will paint them (see `form-control-skeletons`).
 */
export function renderSelectSkeleton(field: SkeletonFieldDef): ReactElement {
  // A schema-declared `default` preselects its option, so the value the user
  // sees before hydration is the value the form will actually write.
  const defaultValue = field.defaultValue !== undefined ? String(field.defaultValue) : ''
  return (
    <CrudFieldShell
      key={field.name}
      field={field}
    >
      <ChoiceSelectSkeleton
        name={field.name}
        value={defaultValue}
        options={field.options ?? []}
        emptyLabel={field.placeholder ?? 'Select...'}
        required={field.required === true}
        disabled={field.disabled === true}
      />
    </CrudFieldShell>
  )
}

/** The date picker's skeleton: a read-only box holding the day, as the island will draw it. */
export function renderDateSkeleton(field: SkeletonFieldDef, value: string): ReactElement {
  return (
    <CrudFieldShell
      key={field.name}
      field={field}
    >
      <DateBoxSkeleton
        name={field.name}
        value={inputValueOf(field, value)}
        required={field.required === true}
        disabled={field.disabled === true}
        pickLabel="Pick a date"
        {...(field.placeholder === undefined ? {} : { placeholder: field.placeholder })}
        boxAttributes={fieldDescribedBy(field)}
      />
    </CrudFieldShell>
  )
}
