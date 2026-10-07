/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { fieldNamesMatch } from '../../../../../tables/field-name-matching'

/** A section as a renderer reads it: its heading, its guidance, its field names. */
export interface FormSectionLayout {
  readonly title: string
  readonly description?: string
  readonly fields: readonly string[]
}

/** One section with the drawn fields it holds, in the section's own order. */
export interface GroupedFormSection<F> {
  readonly title: string
  readonly description?: string
  readonly fields: readonly F[]
}

/** The fields of a sectioned form, split into its sections and the rest. */
export interface GroupedFormFields<F> {
  readonly sections: readonly GroupedFormSection<F>[]
  /** Fields listed in no section, in the form's own order — drawn after the last section. */
  readonly rest: readonly F[]
}

/**
 * Split a form's drawn fields into its `sections`, layout only.
 *
 * Each section takes the fields it lists, in the order it lists them; a name
 * that matches no drawn field (a column this visitor may not read, say) is
 * skipped rather than drawn empty. Every field no section lists stays in
 * `rest`, in the form's order. Names match with the form renderer's folding,
 * so `billingEmail` finds `billing_email`. A field is claimed by the first
 * section listing it — the load-time validation refuses a second listing, so
 * that rule only matters to a config that never reaches a page.
 */
export const groupFieldsIntoSections = <F extends { readonly name: string }>(
  fields: readonly F[],
  sections: readonly FormSectionLayout[] | undefined
): GroupedFormFields<F> => {
  if (sections === undefined || sections.length === 0) return { sections: [], rest: fields }
  const grouped = sections.reduce<{
    readonly claimed: readonly F[]
    readonly out: readonly GroupedFormSection<F>[]
  }>(
    (acc, section) => {
      const own = section.fields.flatMap((name) => {
        const field = fields.find((f) => fieldNamesMatch(f.name, name))
        return field === undefined || acc.claimed.includes(field) ? [] : [field]
      })
      const drawn = {
        title: section.title,
        ...(section.description === undefined ? {} : { description: section.description }),
        fields: own,
      }
      return { claimed: [...acc.claimed, ...own], out: [...acc.out, drawn] }
    },
    { claimed: [], out: [] }
  )
  return {
    sections: grouped.out,
    rest: fields.filter((f) => !grouped.claimed.includes(f)),
  }
}
