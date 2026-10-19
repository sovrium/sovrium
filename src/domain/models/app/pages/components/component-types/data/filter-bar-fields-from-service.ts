/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The fields a `filter-bar` declaring `fieldsFrom: { table }` offers: one per
 * declared field of the table, in declaration order, each filtered as the kind
 * its type implies — so the bar offers the operators that have an answer for
 * the field (`contains` on a name, `between` on an amount, `is any of` on a
 * status).
 *
 * A type with no such kind — a checkbox, an attachment, a computed value — is
 * left out rather than offered as text: a condition on it would compare a stored
 * shape the reader never sees. A many-to-one link is the exception that has an
 * answer: it is offered as a `select` among the related table's rows, by the
 * link's `displayField`, through an `optionsSource` the option-source pass
 * resolves for the reader right after (and removes, so the related table's name
 * never reaches the browser). A link with no `displayField`, or of any other
 * shape — which stores no column to compare — is left out. Which fields the READER
 * may see is the caller's question (`readable`), asked of each field before it
 * is offered, so a restricted field's name never leaves the server.
 */

/** What a filterable field holds — the bar's `FilterFieldKindSchema`. */
export type DerivedFilterKind = 'text' | 'number' | 'date' | 'select'

/** One offered field, in the shape the bar's `fields[]` declares. */
export interface DerivedFilterField {
  readonly name: string
  readonly label?: string
  readonly kind: DerivedFilterKind
  readonly options?: readonly { readonly value: string; readonly label?: string }[]
  /** A link's choices: the related rows by their display field, read for the reader. */
  readonly optionsSource?: {
    readonly table: string
    readonly displayField: string
    readonly sort: readonly { readonly field: string; readonly direction: 'asc' }[]
  }
}

/** The minimum of a table field this derivation reads. */
interface SourceField {
  readonly name: string
  readonly type: string
  readonly label?: unknown
  readonly options?: readonly unknown[]
  readonly relationType?: unknown
  readonly relatedTable?: unknown
  readonly displayField?: unknown
}

/** A many-to-one link as a choice among the related rows, or `undefined` when it offers none. */
function deriveLink(field: SourceField): DerivedFilterField | undefined {
  const { relationType, relatedTable, displayField } = field
  if (relationType !== 'many-to-one' || typeof relatedTable !== 'string') return undefined
  if (typeof displayField !== 'string') return undefined
  return {
    name: field.name,
    ...(typeof field.label === 'string' ? { label: field.label } : {}),
    kind: 'select',
    optionsSource: {
      table: relatedTable,
      displayField,
      sort: [{ field: displayField, direction: 'asc' }],
    },
  }
}

const KIND_OF_TYPE: Readonly<Record<string, DerivedFilterKind>> = {
  'single-line-text': 'text',
  'long-text': 'text',
  email: 'text',
  url: 'text',
  'phone-number': 'text',
  number: 'number',
  integer: 'number',
  decimal: 'number',
  currency: 'number',
  percentage: 'number',
  rating: 'number',
  duration: 'number',
  autonumber: 'number',
  date: 'date',
  datetime: 'date',
  'single-select': 'select',
  'multi-select': 'select',
  status: 'select',
}

/** One declared option as the bar offers it; a plain string is its own value. */
const toOption = (
  option: unknown
): { readonly value: string; readonly label?: string } | undefined => {
  if (typeof option === 'string') return { value: option }
  if (typeof option !== 'object' || option === null) return undefined
  const { value, label } = option as { readonly value?: unknown; readonly label?: unknown }
  if (typeof value !== 'string') return undefined
  return typeof label === 'string' ? { value, label } : { value }
}

/** One field as the bar offers it, or `undefined` when its type has no kind. */
function derive(field: SourceField): DerivedFilterField | undefined {
  if (field.type === 'relationship') return deriveLink(field)
  const kind = KIND_OF_TYPE[field.type]
  if (kind === undefined) return undefined
  const options =
    kind === 'select'
      ? (field.options ?? []).flatMap((option) => {
          const resolved = toOption(option)
          return resolved === undefined ? [] : [resolved]
        })
      : []
  return {
    name: field.name,
    ...(typeof field.label === 'string' ? { label: field.label } : {}),
    kind,
    ...(options.length > 0 ? { options } : {}),
  }
}

/**
 * The fields a bar derives from `fields`, in their order, keeping those the
 * reader may read and whose type has a filter kind.
 */
export function deriveFilterBarFields(
  fields: readonly SourceField[],
  readable: (fieldName: string) => boolean
): readonly DerivedFilterField[] {
  return fields.flatMap((field) => {
    if (!readable(field.name)) return []
    const derived = derive(field)
    return derived === undefined ? [] : [derived]
  })
}
