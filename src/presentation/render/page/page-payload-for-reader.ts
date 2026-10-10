/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ONE place a page's island payload is filtered for its reader.
 *
 * Every island on a page serialises its own props into a `data-island-props`
 * attribute, from whichever renderer draws it. Filtering at each of those
 * renderers would leave the next component unfiltered until someone thought of
 * it. So the filter runs here, over the finished document, on EVERY
 * `data-island-props` it carries: no renderer can serialise around it, and a new
 * component is covered the day it ships.
 *
 * It is fed by the same answer every per-component narrowing reads — the table
 * API's own account of what this caller may read of each table
 * (`readTableAsCaller`, through `readableFieldsOf`) — and drops, from each
 * payload, everything that names a field she may not read
 * (`island-props-for-reader.ts`). Server-drawn controls are not JSON: the
 * forms that draw them narrow their own field list from the same answer
 * (`crud-form-field-resolver.ts`).
 *
 * Only tables whose field names occur in the document are read, so a page that
 * names no field of a table costs no read of it. A no-op without auth, and
 * where no reader was injected (a render outside the page route funnel).
 */

import { readableFieldsOf } from '@/presentation/render/props/caller-table-inputs'
import {
  hidesNothing,
  islandPropsForReader,
  type ReaderFieldModel,
  type ReaderFieldScope,
} from '@/presentation/render/props/island-props-for-reader'
import type { CallerTableView } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Tables } from '@/domain/models/app/tables'
import type { DataSourceDb } from '@/presentation/render/resolve/data-source-contracts'

type Table = Tables[number]

/** The strings a field is known by: its name, its label, its option values. */
function termsOf(field: Table['fields'][number]): readonly string[] {
  const { label, options } = field as { readonly label?: unknown; readonly options?: unknown }
  const optionValues = Array.isArray(options)
    ? options.map((option: unknown) =>
        typeof option === 'object' && option !== null
          ? (option as { readonly value?: unknown }).value
          : option
      )
    : []
  return [label, ...optionValues].filter((term): term is string => typeof term === 'string')
}

/** One table as one reader may read it: what she may not, less what she may. */
function scopeOf(table: Table, callerTable: CallerTableView): ReaderFieldScope {
  const readable = new Set(readableFieldsOf(table, callerTable))
  const hidden = table.fields.filter((field) => !readable.has(field.name))
  const shown = table.fields.filter((field) => readable.has(field.name))
  const shownTerms = new Set(shown.flatMap((field) => [field.name, ...termsOf(field)]))
  return {
    hiddenNames: new Set(hidden.map((field) => field.name)),
    hiddenTerms: new Set(hidden.flatMap(termsOf).filter((term) => !shownTerms.has(term))),
  }
}

/**
 * The names and terms hidden on every table that declares them. A table not
 * read here counts every field it declares as readable — it named none in the
 * document, so it may hold a readable field of the same name.
 */
function everywhereScope(
  app: App,
  byTable: ReadonlyMap<string, ReaderFieldScope>
): ReaderFieldScope {
  const readable = (app.tables ?? []).flatMap((table) => {
    const scope = byTable.get(table.name)
    const shown = table.fields.filter((field) => scope?.hiddenNames.has(field.name) !== true)
    return shown.flatMap((field) => [field.name, ...termsOf(field)])
  })
  const shown = new Set(readable)
  const scopes = [...byTable.values()]
  return {
    hiddenNames: new Set(scopes.flatMap((s) => [...s.hiddenNames]).filter((n) => !shown.has(n))),
    hiddenTerms: new Set(scopes.flatMap((s) => [...s.hiddenTerms]).filter((t) => !shown.has(t))),
  }
}

/**
 * The reader's model of the tables `html` names a field of. A table she may
 * not read at all is skipped: every component over it is withheld whole
 * before the page is drawn (`withheld-component.ts`).
 */
async function readerModelOf(
  html: string,
  ctx: {
    readonly app: App
    readonly session: SessionInfo | undefined
    readonly read: NonNullable<DataSourceDb['readTableAsCaller']>
  }
): Promise<ReaderFieldModel> {
  const named = (ctx.app.tables ?? []).filter((table) =>
    table.fields.some((field) => html.includes(field.name))
  )
  const read = await Promise.all(
    named.map(async (table) => [table, await ctx.read(ctx.app, table.name, ctx.session)] as const)
  )
  const byTable: ReadonlyMap<string, ReaderFieldScope> = new Map(
    read
      .filter(([, callerTable]) => callerTable.permissionMap?.table.read === true)
      .map(([table, callerTable]) => [table.name, scopeOf(table, callerTable)] as const)
  )
  return { byTable, everywhere: everywhereScope(ctx.app, byTable) }
}

/** An attribute value as React escapes it, and back. */
const decodeAttribute = (value: string): string =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

const encodeAttribute = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

/**
 * An island's props, and the island's name when the host writes it just before
 * them (`data-island="…" data-island-props="…"`, the order every island host
 * renders). A host that orders them otherwise is judged without its name —
 * the stricter walk.
 */
const ISLAND_PROPS_ATTRIBUTE = /(data-island="([^"]*)"\s+)?data-island-props="([^"]*)"/g

/** Every `data-island-props` of `html`, filtered for the reader `model` describes. */
export function scrubIslandPayloads(html: string, model: ReaderFieldModel): string {
  const scrub = (document: string): string =>
    document.replace(
      ISLAND_PROPS_ATTRIBUTE,
      (attribute, host: string | undefined, island: string | undefined, encoded: string) => {
        const parsed = parseJson(decodeAttribute(encoded))
        if (parsed === undefined) return attribute
        const filtered = islandPropsForReader(parsed.value, model, scrub, island)
        return filtered === parsed.value
          ? attribute
          : `${host ?? ''}data-island-props="${encodeAttribute(JSON.stringify(filtered))}"`
      }
    )
  return scrub(html)
}

/** The parsed JSON, or `undefined` for an attribute that is not JSON. */
function parseJson(text: string): { readonly value: unknown } | undefined {
  try {
    return { value: JSON.parse(text) as unknown }
  } catch {
    return undefined
  }
}

/**
 * The page `html` as the caller holding `session` may be served it — see the
 * module header. The same string back when nothing on it names a field she
 * may not read.
 */
export async function pagePayloadForReader(
  html: string,
  ctx: {
    readonly app: App
    readonly session: SessionInfo | undefined
    readonly db: DataSourceDb | undefined
  }
): Promise<string> {
  const read = ctx.db?.readTableAsCaller
  if (!ctx.app.auth || read === undefined || !html.includes('data-island-props=')) return html
  const model = await readerModelOf(html, { app: ctx.app, session: ctx.session, read })
  return hidesNothing(model) ? html : scrubIslandPayloads(html, model)
}
