/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `button` widget's server-rendered placeholder.
 *
 * Split into its own module rather than living beside the other skeletons
 * because `crud-form-skeleton.tsx` sits against the 300-line cap that
 * `src/presentation/ui/**` enforces as an error.
 */

import { CrudFieldShell } from './crud-field-shell'
import type { SkeletonFieldDef } from './crud-form-skeleton'
import type { ReactElement } from 'react'

/**
 * A button field's pre-hydration placeholder: the real button, disabled.
 *
 * It carries no value and no `name`, so it never enters a native form
 * submission, and it is disabled because its behaviour lives entirely in the
 * island. Rendering the true label rather than a generic box keeps the layout
 * from shifting when the island swaps the live control in.
 */
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
