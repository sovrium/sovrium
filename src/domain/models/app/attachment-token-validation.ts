/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'

/**
 * A BARE ATTACHMENT TOKEN INSIDE A FILES ADDRESS NESTS ONE ADDRESS IN ANOTHER.
 *
 * In a row template, `$record.<attachment>` is the file's address (a signed
 * link, or the bucket's files address on a public bucket). A template written
 * for the storage key builds an address around it —
 * `/api/buckets/<bucket>/files/$record.<attachment>` — and so puts an address
 * inside an address. `$record.<attachment>.key` is the spelling that gives the
 * key. Each such token earns one WARNING naming its place in the config; the
 * config is still accepted, since the template may be what its author meant.
 *
 * Read on the RAW config, as the deprecation warnings are: only a row template
 * bound to a table (`dataSource.table`) is read, each against the attachment
 * columns of its own table, a nested binding against its own.
 */

const ATTACHMENT_TYPES: ReadonlySet<unknown> = new Set([
  'single-attachment',
  'multiple-attachments',
  'attachment',
])

/** `/files/$record.<field>` with no part after it. A static literal. */
const FILES_ADDRESS_TOKEN =
  /\/files\/\$record\.([a-zA-Z0-9_]+)(?![a-zA-Z0-9_]|\.(?:key|url|name|size|mimeType)(?![a-zA-Z0-9_]))/g

/** One warning: where the token is, and what to write instead. */
export interface AttachmentTokenWarning {
  readonly path: string
  readonly message: string
}

type Columns = Readonly<Record<string, ReadonlySet<string>>>

/** Every table's attachment column names, read off the raw `tables`. */
const attachmentColumnsByTable = (config: Readonly<Record<string, unknown>>): Columns =>
  Object.fromEntries(
    (Array.isArray(config['tables']) ? config['tables'] : []).filter(isRecord).map((table) => [
      String(table['name']),
      new Set(
        (Array.isArray(table['fields']) ? table['fields'] : [])
          .filter(isRecord)
          .filter((field) => ATTACHMENT_TYPES.has(field['type']))
          .map((field) => String(field['name']))
      ),
    ])
  )

const warningsInText = (
  text: string,
  path: string,
  columns: ReadonlySet<string>
): readonly AttachmentTokenWarning[] =>
  [...text.matchAll(FILES_ADDRESS_TOKEN)]
    .map(([, field]) => field as string)
    .filter((field) => columns.has(field))
    .map((field) => ({
      path,
      message: `${path}: \`$record.${field}\` is now the file's address, so this writes an address inside a files address; write \`$record.${field}.key\` there to get the storage key, or use \`$record.${field}\` on its own`,
    }))

/** The table a node binds its row template to, if it binds one. */
const boundTable = (node: Readonly<Record<string, unknown>>): string | undefined => {
  const source = node['dataSource']
  return isRecord(source) && typeof source['table'] === 'string' ? source['table'] : undefined
}

const walk = (
  value: unknown,
  path: string,
  scope: { readonly columns: ReadonlySet<string>; readonly tables: Columns }
): readonly AttachmentTokenWarning[] => {
  if (typeof value === 'string') return warningsInText(value, path, scope.columns)
  if (Array.isArray(value)) return value.flatMap((item, i) => walk(item, `${path}[${i}]`, scope))
  if (!isRecord(value)) return []
  const table = boundTable(value)
  return Object.entries(value).flatMap(([key, child]) => {
    const inner =
      key === 'children' && table !== undefined
        ? { ...scope, columns: scope.tables[table] ?? new Set<string>() }
        : scope
    return walk(child, `${path}.${key}`, inner)
  })
}

/** One warning per bare attachment token written inside a files address of a row template. */
export const collectAttachmentTokenWarnings = (
  config: unknown
): readonly AttachmentTokenWarning[] => {
  if (!isRecord(config) || !Array.isArray(config['pages'])) return []
  const tables = attachmentColumnsByTable(config)
  return walk(config['pages'], 'pages', { columns: new Set<string>(), tables })
}
