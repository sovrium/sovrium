/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isAutofillDetail } from './form-field-props'

/**
 * Refuse a form field `autocomplete` that is not an autofill detail of the HTML
 * standard — a browser silently ignores a hint it does not know, so a typo
 * (`e-mail`) would otherwise switch autofill off with nothing to say why.
 *
 * Checked here, at the app level, rather than on the field schema itself, so
 * the refusal names the form and the field by NAME — the words an author
 * searches her config for — instead of their positions in two arrays.
 */

interface NamedFieldShape {
  readonly name?: unknown
  readonly column?: unknown
  readonly field?: unknown
  readonly autocomplete?: unknown
}

interface AppForAutocompleteValidation {
  readonly forms?: ReadonlyArray<{ readonly name: string; readonly fields?: readonly unknown[] }>
  readonly pages?: ReadonlyArray<{
    readonly name: string
    readonly components?: readonly unknown[]
  }>
  readonly components?: readonly unknown[]
}

const refusal = (where: string, value: string): string =>
  `${where}: autocomplete "${value}" is not an autofill detail of the HTML standard. Use \`off\` to turn autofill off, or a field name such as \`email\`, \`tel\`, \`given-name\`, \`organization\` or \`postal-code\`.`

/** The name a field is known by: a standalone `name`, a bound `column`, a page form `field`. */
const fieldNameOf = (field: NamedFieldShape): string => {
  const name = field.name ?? field.column ?? field.field
  return typeof name === 'string' ? name : ''
}

/** The first field of `fields` whose `autocomplete` is refused, as its refusal. */
const firstRefusedField = (
  fields: readonly unknown[] | undefined,
  where: (fieldName: string) => string
): string | undefined =>
  (fields ?? []).reduce<string | undefined>((acc, entry) => {
    if (acc !== undefined || entry === null || typeof entry !== 'object') return acc
    const field = entry as NamedFieldShape
    const { autocomplete } = field
    if (typeof autocomplete !== 'string' || isAutofillDetail(autocomplete)) return undefined
    return refusal(where(fieldNameOf(field)), autocomplete)
  }, undefined)

/**
 * The first refused field of a `form` component anywhere under `node` — every
 * key is walked, not only `children`, so a form in a breakpoint's children, a
 * slot or a tab panel is checked like one written on the page.
 */
const nestedFormRefusal = (node: unknown, where: (name: string) => string): string | undefined => {
  if (Array.isArray(node)) {
    return node.reduce<string | undefined>(
      (acc, child) => acc ?? nestedFormRefusal(child, where),
      undefined
    )
  }
  if (node === null || typeof node !== 'object') return undefined
  const component = node as { readonly type?: unknown; readonly fields?: unknown }
  const own =
    component.type === 'form' && Array.isArray(component.fields)
      ? firstRefusedField(component.fields, where)
      : undefined
  return (
    own ??
    Object.values(node).reduce<string | undefined>(
      (acc, child) => acc ?? nestedFormRefusal(child, where),
      undefined
    )
  )
}

/** The first refused `autocomplete` on a hosted form or a page form, or `undefined`. */
export const validateFormAutocompleteHints = (
  app: AppForAutocompleteValidation
): string | undefined =>
  (app.forms ?? []).reduce<string | undefined>(
    (acc, form) =>
      acc ?? firstRefusedField(form.fields, (name) => `form '${form.name}' field '${name}'`),
    undefined
  ) ??
  (app.pages ?? []).reduce<string | undefined>(
    (acc, page) =>
      acc ?? nestedFormRefusal(page, (name) => `page '${page.name}' form field '${name}'`),
    undefined
  ) ??
  (app.components ?? []).reduce<string | undefined>((acc, template) => {
    const { name } = (template ?? {}) as { readonly name?: unknown }
    const label = typeof name === 'string' ? `component '${name}'` : 'component template'
    return acc ?? nestedFormRefusal(template, (field) => `${label} form field '${field}'`)
  }, undefined)
