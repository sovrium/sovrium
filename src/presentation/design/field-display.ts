/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How a table field's author-declared `label` / `description` reach a user-facing
 * surface — the ONE place the resolution order lives.
 *
 * Three surfaces read a field's display name (record-drawer panel entry,
 * auto-generated data-table column header, auto-generated form control) and two
 * read its guidance text (form control, drawer entry). Each resolves the same
 * way:
 *
 *   surface-level override  ->  the field's own value  ->  the surface fallback
 *
 * The FALLBACK is deliberately NOT uniform and must not be flattened: the drawer
 * and the column header print the raw `name` verbatim, while the form control
 * humanizes it. Humanizing the raw two would restyle every heading in every
 * already-shipped app with no config edit; de-humanizing the form would regress
 * behaviour an existing green spec asserts. Which is why the fallback is a
 * PARAMETER here rather than a constant — each caller passes its own.
 */

/**
 * Field types whose top-level `label` is NOT an external display name.
 *
 * `button` spends the key on the text printed INSIDE the button (it builds on
 * `BaseFieldWithoutLabelSchema` for exactly that reason), so reading it as a
 * column/entry heading would put the button's caption where its field name
 * belongs. The two properties are different things that collided on a name.
 */
const LABEL_IS_BUTTON_TEXT: ReadonlySet<string> = new Set(['button'])

/** A table-schema field as it reaches a renderer: a bag with an optional type. */
type DeclaredField = Readonly<Record<string, unknown>>

function readNonEmptyString(field: DeclaredField, key: string): string | undefined {
  const value = field[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/**
 * The external display name a table field DECLARES, or `undefined` when it
 * declares none (and for `button`, whose `label` is its own caption).
 */
export function declaredFieldLabel(field: unknown): string | undefined {
  if (typeof field !== 'object' || field === null) return undefined
  const declared = field as DeclaredField
  if (typeof declared['type'] === 'string' && LABEL_IS_BUTTON_TEXT.has(declared['type'])) {
    return undefined
  }
  return readNonEmptyString(declared, 'label')
}

/** The guidance text a table field DECLARES, or `undefined` when it declares none. */
export function declaredFieldDescription(field: unknown): string | undefined {
  if (typeof field !== 'object' || field === null) return undefined
  return readNonEmptyString(field as DeclaredField, 'description')
}

/**
 * Resolve the display name of one field on one surface.
 *
 * @param override - the surface's own override (`recordFields[].label`,
 *   `columns[].label`, `fields[].label`)
 * @param declared - the field's own `label` (see {@link declaredFieldLabel})
 * @param fallback - THIS surface's existing fallback — raw `name` in the drawer
 *   and the column header, humanized in the form control.
 */
export function resolveDisplayLabel(
  override: string | undefined,
  declared: string | undefined,
  fallback: string
): string {
  return override ?? declared ?? fallback
}

/**
 * Resolve the guidance text of one field on one surface.
 *
 * There is no fallback: a field that declares no `description` renders no help
 * text at all. An empty-but-present node would be announced as a blank pause by
 * a screen reader and would open a gap under every control in every shipped app.
 */
export function resolveDisplayDescription(
  override: string | undefined,
  declared: string | undefined
): string | undefined {
  return override ?? declared
}

/**
 * The id of a field's help-text node, referenced by the control's
 * `aria-describedby` so the guidance is announced WITH the field rather than
 * left orphaned as decorative text beside it.
 */
export function fieldDescriptionId(fieldName: string): string {
  return `${fieldName}-description`
}

/**
 * `aria-describedby` for a control, or nothing at all when the field carries no
 * description — never an empty attribute pointing at a node that is not there.
 */
export function fieldDescribedBy(field: { readonly name: string; readonly description?: string }): {
  readonly 'aria-describedby'?: string
} {
  return field.description === undefined
    ? {}
    : { 'aria-describedby': fieldDescriptionId(field.name) }
}
