/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The abbreviations a person writes in capitals, whatever case the identifier
 * spells them in. A closed list, and a short one: identifiers, addresses and
 * the business numbers an app carries. A word reads in capitals only when it
 * IS one of these (or its plain plural), never when it merely contains one, so
 * `video` stays « Video ». Any other word keeps the case it was written in.
 */
const ACRONYMS: ReadonlySet<string> = new Set([
  'api',
  'crm',
  'csv',
  'iban',
  'id',
  'ip',
  'pdf',
  'siren',
  'siret',
  'sku',
  'tva',
  'url',
  'uuid',
  'vat',
])

/** One word of a readable name, in capitals when it is a known abbreviation or its plural. */
const acronymCased = (word: string): string => {
  const lower = word.toLowerCase()
  if (ACRONYMS.has(lower)) return lower.toUpperCase()
  const singular = lower.endsWith('s') ? lower.slice(0, -1) : undefined
  return singular !== undefined && ACRONYMS.has(singular) ? `${singular.toUpperCase()}s` : word
}

/**
 * An identifier as a person reads it: its hyphens, underscores and dots as spaces,
 * a camelCase word boundary as a space, its first letter capitalised —
 * `admin-viewer` reads « Admin viewer », `site_visits` « Site visits »,
 * `renderInvoice` « Render invoice », `record.read` « Record read », `member` « Member ». A run of capitals
 * the name already carries is kept and read as one word: `taxID` reads
 * « Tax ID », `customerURL` « Customer URL », `parseHTMLBody` « Parse HTML
 * body ». A whole word that is one of the few abbreviations above reads in
 * capitals, and so does its plural: `vat_number` reads « VAT number »,
 * `tax_id` « Tax ID », `user_ids` « User IDs ». The rest stays as written, so
 * `ops-EU` keeps its capitals.
 *
 * The last resort of every console name below, for an identifier that declares
 * no `label` and that the console has no words of its own for; the identifier
 * stays what every write and every address takes.
 */
export const readableName = (name: string): string => {
  const spaced = name
    .replace(
      /([a-z0-9])([A-Z])(?=[a-z])/g,
      (_match, before: string, upper: string) => `${before} ${upper.toLowerCase()}`
    )
    // A run of capitals before a capitalised word: `HTMLBody` → `HTML body`.
    // Two lower-case letters at least, so a plural run (`IDs`) stays one word.
    .replace(
      /([A-Z]+)([A-Z])(?=[a-z]{2})/g,
      (_match, run: string, upper: string) => `${run} ${upper.toLowerCase()}`
    )
    // A run of capitals after a lower-case letter: `taxID` → `tax ID`.
    .replace(/([a-z0-9])([A-Z]{2,})/g, '$1 $2')
    .replace(/[-_.]+/g, ' ')
    .trim()
  if (spaced.length === 0) return name
  const cased = spaced.split(' ').map(acronymCased).join(' ')
  return `${cased.charAt(0).toUpperCase()}${cased.slice(1)}`
}

/**
 * The console's own words for the roles every app carries, per console
 * language. `admin-viewer` is the read-only console tier, so it reads as what
 * it is rather than as its identifier; `admin-editor` and `operator`, the other
 * admin tiers the invite dialog offers, are named in every language too.
 */
const CONSOLE_ROLE_WORDS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  en: {
    admin: 'Admin',
    member: 'Member',
    viewer: 'Viewer',
    'admin-viewer': 'Admin (read-only)',
    'admin-editor': 'Admin editor',
    operator: 'Operator',
  },
  fr: {
    admin: 'Administrateur',
    member: 'Membre',
    viewer: 'Lecteur',
    'admin-viewer': 'Administrateur (lecture seule)',
    'admin-editor': 'Administrateur (édition)',
    operator: 'Opérateur',
  },
}

/** The slice of `auth` a label is read from. */
export interface LabelSource {
  readonly roles?: ReadonlyArray<{ readonly name: string; readonly label?: string }>
  readonly groups?: ReadonlyArray<{ readonly name: string; readonly label?: string }>
}

/** Reads a declared label's `$t:` key in the reader's language; plain text passes through. */
export type LabelTranslator = (text: string) => string

/**
 * What the console calls a role, in `language` (a console language code):
 * the `label` the app declares on it (through `translate`), else the console's
 * own words for a role every app carries, else its name made readable. The
 * name stays what every write and every permission takes.
 */
export const roleLabelFor = (
  auth: LabelSource | undefined,
  name: string,
  language: string,
  translate: LabelTranslator
): string => {
  const declared = auth?.roles?.find((role) => role.name === name)?.label
  if (declared !== undefined) return translate(declared)
  return (CONSOLE_ROLE_WORDS[language] ?? CONSOLE_ROLE_WORDS['en'])?.[name] ?? readableName(name)
}

/**
 * What the console calls a group: the `label` the app declares on it (through
 * `translate`), else its name made readable.
 */
export const groupLabelFor = (
  auth: LabelSource | undefined,
  name: string,
  translate: LabelTranslator
): string => {
  const declared = auth?.groups?.find((group) => group.name === name)?.label
  return declared === undefined ? readableName(name) : translate(declared)
}

/** Anything the console names: an identifier, and the label it may declare. */
export interface NamedEntity {
  readonly name: string
  readonly label?: string | undefined
}

/** A declared label with something in it, or `undefined`. */
const declaredLabel = (label: string | undefined): string | undefined =>
  label === undefined || label.trim() === '' ? undefined : label

/**
 * What the console calls an automation or one of its steps: the `label` it
 * declares (through `translate`), else its name made readable. The name stays
 * what every filter, every run row and every address takes.
 */
export const entityLabelFor = (
  entity: NamedEntity,
  translate: LabelTranslator = (text) => text
): string => {
  const declared = declaredLabel(entity.label)
  return declared === undefined ? readableName(entity.name) : translate(declared)
}

/** The parts of a table the console names it from. */
export interface TableLabelSource extends NamedEntity {
  readonly labelPlural?: string | undefined
}

/**
 * What the console calls a table: `labelPlural` names the collection (a sidebar
 * row, a breadcrumb, a grid's name) — the declared plural, else the declared
 * singular, through `translate`, else the table name made readable, never the
 * raw identifier an operator's own app pages keep as their last resort.
 * `label` names one record's table and is the declared one only: the singular
 * is never derived from a name, which is usually plural (`New Plans`).
 */
export const tableLabelsFor = (
  table: TableLabelSource,
  translate: LabelTranslator
): { readonly label?: string; readonly labelPlural: string } => {
  const singular = declaredLabel(table.label)
  const plural = declaredLabel(table.labelPlural) ?? singular
  return {
    ...(singular === undefined ? {} : { label: translate(singular) }),
    labelPlural: plural === undefined ? readableName(table.name) : translate(plural),
  }
}

/** The parts of a table the console names it, and each of its fields, from. */
export interface TableWithFieldsLabelSource extends TableLabelSource {
  readonly fields?: ReadonlyArray<NamedEntity> | undefined
}

/**
 * A field's options with each declared `label` through `translate`, so a
 * choice reads in the reader's language; a bare-string option, and the value
 * every option stores, are left as written.
 */
const readableOptions = (field: object, translate: LabelTranslator): object => {
  const { options } = field as { readonly options?: unknown }
  if (!Array.isArray(options)) return {}
  return {
    options: options.map((option: unknown) => {
      const { label } = (option ?? {}) as { readonly label?: unknown }
      return typeof label === 'string' ? { ...(option as object), label: translate(label) } : option
    }),
  }
}

/**
 * The table with its labels resolved by {@link tableLabelsFor}, each field
 * named by {@link entityLabelFor} and its options' labels translated, for a
 * reader that cannot reach the app's translations (a table carried into the
 * console's render) — so it reads finished text, a readable plural where none
 * is declared, and every field in sentence case (`due_date` reads « Due date »)
 * where it declares no label.
 */
export const withReadableTableLabels = <T extends TableWithFieldsLabelSource>(
  table: T,
  translate: LabelTranslator
): T => ({
  ...table,
  ...tableLabelsFor(table, translate),
  ...(table.fields === undefined
    ? {}
    : {
        fields: table.fields.map((field) => ({
          ...field,
          label: entityLabelFor(field, translate),
          ...readableOptions(field, translate),
        })),
      }),
})
