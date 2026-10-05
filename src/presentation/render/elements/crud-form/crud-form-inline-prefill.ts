/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `inlinePrefill` on a form declared IN PLACE — its own `dataSource`, its own
 * `fields`, a `crud` create action — rather than embedded by `formRef`.
 *
 * A `formRef` embed resolves its prefill while it is expanded into markup. An
 * in-place form is drawn later, by the crud-form renderer, which never sees the
 * host page's record. So the page walk that expands `formRef`s also resolves the
 * in-place form's prefill — through the one shared token resolver — and stamps
 * the answer on a render-time-only field (`stampInlineCrudPrefill`,
 * `render/forms/form-ref-resolver.ts`). This module owns that field: its key,
 * its shape, and how the renderer applies it. An author can never supply it: it
 * is added after the page config is decoded.
 */

import type { ResolvedFieldDef } from './crud-form-types'
import type { Component } from '@/domain/models/app/pages/components'

/** The render-time field carrying an in-place form's resolved prefill. */
export const INLINE_CRUD_PREFILL_KEY = '_inlinePrefill'

/** One resolved prefill value: a scalar, or a list for a multi-valued field. */
type ResolvedPrefillValue = string | number | boolean | readonly string[] | readonly number[]

/** An in-place form's prefill, resolved against the host page. */
export interface ResolvedInlineCrudPrefill {
  readonly values: Readonly<Record<string, ResolvedPrefillValue>>
  /** When true, every prefilled field is submitted from a hidden input. */
  readonly lock: boolean
}

function readInlineCrudPrefill(
  component: Component | undefined
): ResolvedInlineCrudPrefill | undefined {
  const stamped = (component as Record<string, unknown> | undefined)?.[INLINE_CRUD_PREFILL_KEY]
  if (typeof stamped !== 'object' || stamped === null) return undefined
  return stamped as ResolvedInlineCrudPrefill
}

/** A form control holds one value; a list is held comma-joined, as the picker holds it. */
function toControlValue(value: ResolvedPrefillValue): string | number | boolean {
  return Array.isArray(value) ? value.join(',') : (value as string | number | boolean)
}

/**
 * Start each prefilled field from its resolved value — and, when the prefill is
 * locked, submit it from a hidden input the visitor cannot edit. Fields the
 * prefill does not name keep their own defaults.
 */
export function applyInlineCrudPrefill(
  fields: readonly ResolvedFieldDef[],
  component: Component | undefined
): readonly ResolvedFieldDef[] {
  const prefill = readInlineCrudPrefill(component)
  if (prefill === undefined) return fields
  return fields.map((field) => {
    const value = prefill.values[field.name]
    if (value === undefined) return field
    return {
      ...field,
      defaultValue: toControlValue(value),
      ...(prefill.lock ? { hidden: true } : {}),
    }
  })
}
