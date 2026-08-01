/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { CrudFieldShell } from './crud-field-shell'
import type { SkeletonFieldDef } from './crud-form-skeleton'
import type { ReactElement } from 'react'

export function renderButtonSkeleton(field: SkeletonFieldDef): ReactElement {
  return (
    <CrudFieldShell
      key={field.name}
      field={field}
    >
      <button
        type="button"
        data-button-field={field.name}
        disabled
      >
        {field.button?.label ?? field.displayLabel ?? field.name}
      </button>
    </CrudFieldShell>
  )
}
