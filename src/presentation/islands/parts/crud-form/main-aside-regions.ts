/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  type FormSectionLayout,
  groupFieldsIntoSections,
} from '@/domain/models/app/pages/components/component-types/data/form/sections-service'
import type { FieldDef } from './fields'

/** A `main-aside` form's aside, as the server resolved it. */
export interface FormAsideLayout {
  /** The aside column's width from lg up, in px or rem. */
  readonly width?: string
  /** The fields whose `region` is `aside`. */
  readonly fields: readonly string[]
}

/**
 * Split a form's fields between its two regions, each keeping its declared
 * order.
 *
 * @param fields - Every field the form draws.
 * @param aside - The server-resolved aside.
 */
export const splitFormRegions = (
  fields: readonly FieldDef[],
  aside: FormAsideLayout
): { readonly main: readonly FieldDef[]; readonly aside: readonly FieldDef[] } => {
  const inAside = new Set(aside.fields)
  return {
    main: fields.filter((field) => !inAside.has(field.name)),
    aside: fields.filter((field) => inAside.has(field.name)),
  }
}

/**
 * The aside a form draws: the server-resolved one, under `layout: main-aside`
 * only.
 *
 * @param layout - The form's `layout`.
 * @param aside - The server-resolved aside, if any.
 */
export const formAsideOf = (
  layout: string | undefined,
  aside: FormAsideLayout | undefined
): FormAsideLayout | undefined => (layout === 'main-aside' ? aside : undefined)

/**
 * The `sections` a run of fields draws. Under `main-aside` each column keeps only
 * the sections holding one of its fields, so a heading is never drawn empty in
 * the other column; every other layout passes them through.
 */
export function columnSections(
  sections: readonly FormSectionLayout[] | undefined,
  aside: FormAsideLayout | undefined,
  subset: readonly FieldDef[]
): { readonly sections?: readonly FormSectionLayout[] } {
  if (sections === undefined) return {}
  if (aside === undefined) return { sections }
  return {
    sections: sections.filter(
      (section) => groupFieldsIntoSections(subset, [section]).rest.length < subset.length
    ),
  }
}
