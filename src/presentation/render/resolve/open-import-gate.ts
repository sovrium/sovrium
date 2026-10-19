/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  IMPORT_FIELD_LABELS_KEY,
  IMPORT_OPTION_LABELS_KEY,
  optionLabelsInEveryLanguage,
  type OptionLabelCandidates,
} from '@/domain/models/app/auth/console-table-view-service'
import { hasCreatePermissionForRoles } from '@/domain/models/app/auth/permission-evaluator-service'
import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import { declaredFieldLabel } from '@/presentation/design/field-display'
import { resolveTableImportFields } from '@/presentation/render/props/resolve-type-specific-inputs'
import { writeGateRoles } from './write-permission-gates'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Languages } from '@/domain/models/app/languages'
import type { CallerCapability } from '@/domain/models/app/pages/components/visibility'

/**
 * The render-time gate of an `openImport` button: drawn only for a reader the
 * table lets create records, and stamped with the fields the import dialog maps
 * a CSV onto.
 *
 * An import writes records, so it follows the create gate a grid's add-row
 * follows: ABSENT, never disabled, for a reader who may not create — a disabled
 * control still tells the reader the table exists and what it would accept, and
 * offering a control the records API would refuse is a dead end. A mounted
 * console page renders without a session, so there the caller's stated powers
 * decide: no `edit-operations`, no import.
 */

/** The facts the gate reads about the request. */
export interface OpenImportGateContext {
  readonly session: SessionInfo | undefined
  readonly app: App
  /** The caller's powers on a mount; absent everywhere else. */
  readonly granted?: ReadonlySet<CallerCapability>
}

/** The table an `openImport` action names, or `undefined` when the node holds none. */
export function openImportTable(node: unknown): string | undefined {
  const { action } = (node ?? {}) as { readonly action?: unknown }
  if (typeof action !== 'object' || action === null) return undefined
  const { action: kind, table } = action as { readonly action?: unknown; readonly table?: unknown }
  return kind === 'openImport' && typeof table === 'string' ? table : undefined
}

/** Whether the caller may create in `tableName`, the way the records API will judge it. */
function mayCreate(tableName: string, ctx: OpenImportGateContext): boolean {
  if (ctx.granted !== undefined && !ctx.granted.has('edit-operations')) return false
  if (!ctx.app.auth) return true
  if (ctx.session === undefined) return false
  const table = ctx.app.tables?.find((candidate) => candidate.name === tableName)
  return hasCreatePermissionForRoles(table, writeGateRoles(ctx.session), ctx.app)
}

/** Keep every node but an `openImport` button its reader may not use. */
export function isOpenImportAdmitted(node: unknown, ctx: OpenImportGateContext): boolean {
  const table = openImportTable(node)
  return table === undefined || mayCreate(table, ctx)
}

/**
 * Each field's label in every language the app declares, by field name — the
 * words a spreadsheet kept in any of those languages heads its columns with,
 * whatever language the page itself is read in. Only the fields the dialog
 * offers are read, and one with no label of its own is left out: its name is
 * matched already.
 */
function importLabelCandidates(
  fields: ReadonlyArray<unknown>,
  offered: readonly string[],
  languages: Languages | undefined
): Readonly<Record<string, readonly string[]>> {
  const codes = languages?.supported.map((language) => language.code) ?? []
  const offeredNames = new Set(offered)
  return Object.fromEntries(
    fields.flatMap((field) => {
      const label = declaredFieldLabel(field)
      const { name } = field as { readonly name?: unknown }
      if (label === undefined || typeof name !== 'string' || !offeredNames.has(name)) return []
      const resolved = codes.map((code) => resolveTranslationPattern(label, code, languages))
      const candidates = [
        ...new Set((resolved.length > 0 ? resolved : [label]).filter((l) => !l.startsWith('$t:'))),
      ]
      return candidates.length > 0 ? [[name, candidates]] : []
    })
  )
}

/**
 * `candidates` joined, for the fields the dialog offers, by the labels a table
 * the console carries holds in every language its own app declares
 * ({@link IMPORT_FIELD_LABELS_KEY}): its `label`s are finished text in the
 * operator's language by now, and the rendering app's languages are the
 * console's, so neither alone can name a header written in another language.
 */
function withCarriedLabels(
  candidates: Readonly<Record<string, readonly string[]>>,
  table: object,
  offered: readonly string[]
): Readonly<Record<string, readonly string[]>> {
  const carried = (table as Readonly<Record<string, unknown>>)[IMPORT_FIELD_LABELS_KEY] as
    Readonly<Record<string, readonly string[]>> | undefined
  if (carried === undefined) return candidates
  return Object.fromEntries(
    offered.flatMap((name) => {
      const labels = [...new Set([...(candidates[name] ?? []), ...(carried[name] ?? [])])]
      return labels.length === 0 ? [] : [[name, labels]]
    })
  )
}

/**
 * Each offered field's metadata joined by its options' labels in every
 * language the app declares, by option value (`optionLabels`) — read from the
 * table's own options, and from those a table the console carries holds
 * ({@link IMPORT_OPTION_LABELS_KEY}) — so a CSV value spelling an option by its
 * label in any of those languages finds that option.
 */
function withOptionLabels(
  fieldMeta: Readonly<Record<string, unknown>>,
  table: Readonly<{ readonly fields: ReadonlyArray<unknown> }>,
  offered: readonly string[],
  languages: Languages | undefined
): Readonly<Record<string, unknown>> {
  const codes = languages?.supported.map((language) => language.code) ?? []
  const translators = codes.map(
    (code) => (text: string) => resolveTranslationPattern(text, code, languages)
  )
  const own = optionLabelsInEveryLanguage(
    table.fields,
    translators.length > 0 ? translators : [(text: string) => text]
  )
  const carried = (table as Readonly<Record<string, unknown>>)[IMPORT_OPTION_LABELS_KEY] as
    OptionLabelCandidates | undefined
  return Object.fromEntries(
    Object.entries(fieldMeta).map(([name, meta]) => {
      const byValue = [own[name], carried?.[name]].flatMap((labels) => Object.entries(labels ?? {}))
      if (!offered.includes(name) || byValue.length === 0) return [name, meta]
      const optionLabels = byValue.reduce<Readonly<Record<string, readonly string[]>>>(
        (merged, [value, labels]) => ({
          ...merged,
          [value]: [...new Set([...(merged[value] ?? []), ...labels])],
        }),
        {}
      )
      return [name, { ...(meta as object), optionLabels }]
    })
  )
}

/**
 * An `openImport` button with the fields of its table — and their labels in
 * every declared language — stamped under `props._import`, which the button renderer hands to the import island. Any
 * other node is returned untouched.
 */
export function stampOpenImportFields(node: object, app: App): object {
  const tableName = openImportTable(node)
  if (tableName === undefined) return node
  const table = app.tables?.find((candidate) => candidate.name === tableName)
  if (table === undefined) return node
  const { props } = node as { readonly props?: Record<string, unknown> }
  const fields = resolveTableImportFields(table, app.tables)
  return {
    ...node,
    props: {
      ...props,
      _import: {
        ...fields,
        fieldMeta: withOptionLabels(fields.fieldMeta, table, fields.tableFields, app.languages),
        fieldLabels: withCarriedLabels(
          importLabelCandidates(table.fields, fields.tableFields, app.languages),
          table,
          fields.tableFields
        ),
      },
    },
  }
}
