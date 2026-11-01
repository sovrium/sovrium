/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The pure half of `sovrium client`: the generated file's text, from the app's
 * tables and the embedded runtime. No I/O, so the same config and the same
 * binary always render the same bytes.
 *
 * The types follow the records API's wire contract
 * (`src/domain/models/api/tables/`): a record is `{ id, fields, createdAt,
 * updatedAt, createdBy?, updatedBy? }`, and every key of `fields` is optional
 * and nullable on a read, because field permissions omit what a caller may not
 * read.
 */

/** A field as the renderer reads it off the config. */
export interface ClientFieldInput {
  readonly name: string
  readonly type: string
  readonly required?: boolean
  readonly options?: readonly unknown[]
  readonly relationType?: string
}

/** A table as the renderer reads it off the config. */
export interface ClientTableInput {
  readonly name: string
  readonly fields?: readonly ClientFieldInput[]
  readonly views?: readonly { readonly id: string | number }[]
}

export interface ClientFileInput {
  readonly appName: string
  readonly version: string
  /** The embedded runtime source, as `CLIENT_RUNTIME_SOURCE` carries it. */
  readonly runtime: string
  readonly tables: readonly ClientTableInput[]
}

const STRING_TYPES: ReadonlySet<string> = new Set([
  'single-line-text',
  'long-text',
  'email',
  'url',
  'phone-number',
  'rich-text',
  'date',
  'datetime',
  'time',
  'created-at',
  'updated-at',
  'deleted-at',
  'created-by',
  'updated-by',
  'deleted-by',
  'user',
  'barcode',
  'code',
  'color',
])

const NUMBER_TYPES: ReadonlySet<string> = new Set([
  'integer',
  'number',
  'decimal',
  'currency',
  'percentage',
  'rating',
  'progress',
  'duration',
  'autonumber',
  'count',
])

/** Computed and system-written types: read on a row, never written by a caller. */
const NOT_WRITABLE_TYPES: ReadonlySet<string> = new Set([
  'formula',
  'rollup',
  'lookup',
  'count',
  'autonumber',
  'button',
  'created-at',
  'updated-at',
  'deleted-at',
  'created-by',
  'updated-by',
  'deleted-by',
])

const MANY_RELATIONS: ReadonlySet<string> = new Set(['one-to-many', 'many-to-many'])

const normaliseType = (type: string): string => type.replaceAll('_', '-')

/** A TypeScript literal for a string or number, escaped. */
const literal = (value: string | number): string => JSON.stringify(value)

/** A property key: bare when it is an identifier, quoted otherwise. */
const propertyKey = (name: string): string =>
  /^[A-Za-z_$][\w$]*$/.test(name) ? name : literal(name)

const optionValue = (option: unknown): string | undefined => {
  if (typeof option === 'string') return option
  if (typeof option === 'object' && option !== null && 'value' in option) {
    const { value } = option as { readonly value: unknown }
    return typeof value === 'string' ? value : undefined
  }
  return undefined
}

const optionUnion = (field: ClientFieldInput): string => {
  const values = (field.options ?? []).flatMap((option) => {
    const value = optionValue(option)
    return value === undefined ? [] : [literal(value)]
  })
  return values.length === 0 ? 'string' : values.join(' | ')
}

/** The TypeScript type a field's value has on the wire. */
export const fieldValueType = (field: ClientFieldInput): string => {
  const type = normaliseType(field.type)
  if (STRING_TYPES.has(type)) return 'string'
  if (NUMBER_TYPES.has(type)) return 'number'
  if (type === 'checkbox') return 'boolean'
  if (type === 'single-select' || type === 'status') return optionUnion(field)
  if (type === 'multi-select') return `ReadonlyArray<${optionUnion(field)}>`
  if (type === 'relationship') {
    return MANY_RELATIONS.has(field.relationType ?? '') ? 'ReadonlyArray<string>' : 'string'
  }
  return 'unknown'
}

const isWritable = (field: ClientFieldInput): boolean =>
  !NOT_WRITABLE_TYPES.has(normaliseType(field.type))

const objectType = (members: readonly string[], indent: string): string =>
  members.length === 0
    ? 'Record<string, never>'
    : `{\n${members.map((member) => `${indent}  ${member}`).join('\n')}\n${indent}}`

/** A required member, or an optional one that may be cleared with `null`. */
const member = (field: ClientFieldInput, required: boolean, nullable = true): string => {
  const value = fieldValueType(field)
  if (required) return `readonly ${propertyKey(field.name)}: ${value}`
  return `readonly ${propertyKey(field.name)}?: ${value}${nullable ? ' | null' : ''}`
}

/** One table's entry in the generated `AppTables` map. */
export const renderTableShape = (table: ClientTableInput): string => {
  const fields = table.fields ?? []
  const writable = fields.filter(isWritable)
  const views = (table.views ?? []).map((view) => literal(view.id))
  const indent = '    '
  return [
    `  ${propertyKey(table.name)}: {`,
    `    readonly row: ${objectType(
      fields.map((field) => member(field, false)),
      indent
    )}`,
    `    readonly insert: ${objectType(
      writable.map((field) => member(field, field.required === true)),
      indent
    )}`,
    `    readonly update: ${objectType(
      writable.map((field) => member(field, false, field.required !== true)),
      indent
    )}`,
    `    readonly view: ${views.length === 0 ? 'never' : views.join(' | ')}`,
    '  }',
  ].join('\n')
}

/** The runtime without its copyright header: the generated file is the user's own. */
export const stripRuntimeHeader = (runtime: string): string =>
  runtime.replace(/^\/\*\*\n \* Copyright[\s\S]*?\*\/\n+/, '')

const banner = (appName: string, version: string): string =>
  [
    `// The typed client for the records API of the ${literal(appName)} app.`,
    `// Written by Sovrium ${version} with \`sovrium client\`. Do not edit this file: run`,
    '// `sovrium client` again after changing a table, a field or a view, and it is replaced.',
    '// It imports nothing and needs nothing installed: copy it into any TypeScript project.',
  ].join('\n')

const appSection = (tables: readonly ClientTableInput[]): string =>
  [
    '// ---------------------------------------------------------------------------',
    "// The app's tables",
    '// ---------------------------------------------------------------------------',
    '',
    '/** Each table: its row, what a create requires, what an update may change, its views. */',
    `export type AppTables = {\n${tables.map(renderTableShape).join('\n')}\n}`,
    '',
    'export type TableName = keyof AppTables',
    '',
    '/** A record of the table, as a read answers it. */',
    "export type Row<T extends TableName> = ClientRecord<AppTables[T]['row']>",
    '',
    '/** The fields a create sends: required fields required, computed fields left out. */',
    "export type Insert<T extends TableName> = AppTables[T]['insert']",
    '',
    '/** The fields an update may send, every one optional. */',
    "export type Update<T extends TableName> = AppTables[T]['update']",
    '',
    '/** The client for this app. */',
    'export const createClient = (options: ClientOptions = {}): SovriumClient<AppTables> =>',
    '  createSovriumClient<AppTables>(options)',
  ].join('\n')

/** The whole generated file. */
export const renderClientFile = (input: ClientFileInput): string =>
  [
    banner(input.appName, input.version),
    '',
    stripRuntimeHeader(input.runtime).trimEnd(),
    '',
    appSection(input.tables),
    '',
  ].join('\n')
