/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveFieldDef } from './crud-form-field-resolver'
import type { ResolvedFieldDef } from './crud-form-types'
import type { Component } from '@/domain/models/app/pages/components'
import type { FormFieldConfig } from '@/domain/models/app/pages/components/component-types/data/form'

/**
 * The field type each `control` is drawn and sent as, on a form bound to no
 * table: the column a table-bound form would read the same value from. A
 * `password` and a `textarea` keep their control, as they do on a column.
 */
const CONTROL_FIELD_TYPE: Readonly<Record<string, string>> = {
  text: 'single-line-text',
  password: 'single-line-text',
  email: 'email',
  number: 'decimal',
  tel: 'phone-number',
  url: 'url',
  textarea: 'long-text',
  select: 'single-select',
  switch: 'checkbox',
  rating: 'rating',
}

/**
 * The fields a form bound to no table draws: each `fields[]` entry that
 * declares its own `control`, as the column that control stands for. A form
 * that runs an automation needs no table to ask its questions, and what is
 * typed is sent as the run's input.
 */
export function controlFieldDefs(component: Component | undefined): readonly ResolvedFieldDef[] {
  const { fields } = (component ?? {}) as { readonly fields?: readonly FormFieldConfig[] }
  return (fields ?? []).flatMap((cfg) => {
    const type = cfg.control === undefined ? undefined : CONTROL_FIELD_TYPE[cfg.control]
    if (type === undefined) return []
    const column = {
      name: cfg.field,
      type,
      ...(cfg.required === true && { required: true }),
      ...(cfg.options !== undefined && { options: cfg.options }),
      ...(cfg.max !== undefined && { max: cfg.max }),
    }
    return [resolveFieldDef(column, cfg, undefined)]
  })
}
