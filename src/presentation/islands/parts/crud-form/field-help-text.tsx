/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { fieldDescriptionId } from '@/presentation/design/field-display'
import { computeFormHelpTextClasses } from '@/presentation/design/form-layout-classes'
import { type FieldDef } from './field-def'
import type { ReactElement } from 'react'

const HELP_TEXT_CLASS = `help-text ${computeFormHelpTextClasses()}`

/**
 * The field's persistent guidance, under its control and addressed by the
 * control's `aria-describedby`. Renders NOTHING when the field declares no
 * description — an empty node would be announced as a blank pause. Mirrors the
 * SSR `CrudFieldShell` so hydration does not move the text. Shared by the plain
 * inputs and the typed controls.
 */
export function FieldHelpText({ field }: { readonly field: FieldDef }): ReactElement | undefined {
  if (field.description === undefined) return undefined
  return (
    <small
      id={fieldDescriptionId(field.name)}
      className={HELP_TEXT_CLASS}
    >
      {field.description}
    </small>
  )
}
