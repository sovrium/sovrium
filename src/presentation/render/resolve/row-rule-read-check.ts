/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A table's row-level read rule, asked in memory for one visitor: of a row
 * ({@link rowCheckOf}), and of the rows a lookup copies a value from
 * ({@link withRowRuledLookupsHidden}) — a lookup through a link to a row the
 * related table hides from her is left out, as the records API leaves it out.
 * The page read gates of `record-read-gate.ts` answer through both.
 */

import {
  callerTableGate,
  type CallerReader,
} from '@/domain/models/app/tables/caller-record-gate-service'
import {
  chainedLookupLinksOf,
  lookupKeyColumnsFor,
  lookupLinksOf,
  namesLookup,
  withFormulasOver,
  withoutLookups,
  type LookupLink,
} from '@/domain/models/app/tables/lookup-link-service'
import {
  parseAssignmentScopeKey,
  type CurrentUserContext,
} from '@/domain/models/app/tables/row-level-evaluator-service'
import {
  readerContextOf,
  type VisitorRowRule,
} from '@/domain/models/app/tables/visitor-row-rule-service'
import { logError } from '@/infrastructure/logging/logger'
import type { DataSourceDb } from './data-source-contracts'
import type { App } from '@/domain/models/app'

type RecordRow = Readonly<Record<string, unknown>>

/** "May this visitor see this row?" — `undefined` when there is nothing to ask. */
export type RowLevelReadCheck = (record: RecordRow) => Promise<boolean>

/**
 * The visitor's `user_access` record ids for every assignments key the rule
 * reads (a scope table, or a scope table and one grant role),
 * in parallel. A failed read degrades to "no assignments": the rule then
 * fails, which is the safe direction.
 */
async function loadAssignmentsForScopes(
  userId: string,
  scopeTables: readonly string[],
  db: DataSourceDb
): Promise<ReadonlyMap<string, readonly string[]>> {
  if (scopeTables.length === 0) return new Map<string, readonly string[]>()
  const entries = await Promise.all(
    scopeTables.map(async (key): Promise<readonly [string, readonly string[]]> => {
      const { tableSlug, role } = parseAssignmentScopeKey(key)
      const read = db.fetchUserAssignments(userId, tableSlug, role)
      return [key, await read.catch(() => [] as readonly string[])]
    })
  )
  return new Map(entries)
}

/**
 * The context the rule judges `reader` by: the records API's own, when the
 * request supplies a loader (`db.loadRowRuleContext`, read once per request
 * and table), else her assignments alone — under which a `contains` or
 * relationship leaf admits no row. A load that fails is logged and admits no
 * row at all: failing closed is the safe direction.
 */
async function readerContext(
  rule: Extract<VisitorRowRule, { readonly kind: 'check' }>,
  reader: CallerReader | undefined,
  at: RowCheckSite
): Promise<CurrentUserContext | undefined> {
  try {
    if (at.db.loadRowRuleContext !== undefined) {
      return await at.db.loadRowRuleContext(at.app, at.tableName, reader)
    }
    const assignments =
      reader === undefined || rule.scopeTables.length === 0
        ? new Map<string, readonly string[]>()
        : await loadAssignmentsForScopes(reader.userId, rule.scopeTables, at.db)
    return readerContextOf(reader, assignments)
  } catch (error) {
    logError(`[pages] the row rule of ${at.tableName} could not be loaded; no row is shown`, error)
    return undefined
  }
}

/** Where a row check is asked: the app, the ruled table, and the readers of this request. */
export interface RowCheckSite {
  readonly app: App
  readonly tableName: string
  readonly db: DataSourceDb
}

/**
 * The in-memory check of a table's row-level rule for one reader — the
 * domain's {@link visitorRowRule}, judged against the context the records API
 * judges her by ({@link readerContext}). `undefined` when there is nothing to
 * check: the table declares no `rowLevelPermissions.read.when`, or the reader
 * is unrestricted (the records API lets an admin-equivalent role read every
 * row, and pages mirror it).
 *
 * A rule naming the signed-in person (`$currentUser.…`) shows an anonymous
 * visitor no row — there is no user to evaluate it against, and failing closed
 * is what the records API's own `'unresolved'` plan does. A rule naming no one
 * (`status = published`) applies to an anonymous reader as to anyone else, as
 * it does on the records API.
 *
 * The context is read once per check, however many rows it is then asked about.
 */
export function rowCheckOf(
  rule: VisitorRowRule,
  reader: CallerReader | undefined,
  at: RowCheckSite
): RowLevelReadCheck | undefined {
  if (rule.kind === 'all') return undefined
  if (rule.kind === 'none') return () => Promise.resolve(false)
  const context = readerContext(rule, reader, at)
  return async (record) => {
    const loaded = await context
    return loaded !== undefined && rule.admits(record, loaded)
  }
}

/** The key a lookup's relationship column holds on a row, if any. */
const linkKeyOf = (row: RecordRow, link: LookupLink): string | undefined => {
  const value = row[link.relationship]
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'object') {
    const { id } = value as { readonly id?: unknown }
    return id === undefined || id === null ? undefined : String(id)
  }
  return String(value)
}

/**
 * One link's verdict for a page of rows: the linked keys the visitor may read
 * in the related table, or `undefined` when its row-level rule hides nothing
 * from her. Read once, for every key the rows name.
 */
async function readableLinkedKeys(
  app: App,
  link: LookupLink,
  rows: readonly RecordRow[],
  ctx: { readonly reader: CallerReader | undefined; readonly db: DataSourceDb }
): Promise<ReadonlySet<string> | undefined> {
  const gate = callerTableGate(app, link.relatedTable.name, ctx.reader)
  if (gate.kind === 'refused') return new Set<string>()
  const check = rowCheckOf(gate.rule, ctx.reader, {
    app,
    tableName: link.relatedTable.name,
    db: ctx.db,
  })
  if (check === undefined) return undefined
  const keys = [
    ...new Set(rows.flatMap((row) => (link.road === 'column' ? [linkKeyOf(row, link)] : []))),
  ].filter((key): key is string => key !== undefined)
  if (keys.length === 0) return new Set<string>()
  const linked = await ctx.db.fetchRecords(link.relatedTable.name, {
    filter: [{ field: 'id', operator: 'in', value: keys }],
  })
  const verdicts = await Promise.all(linked.map((row) => check(row)))
  return new Set(linked.filter((_, index) => verdicts[index] === true).map((row) => String(row.id)))
}

/** How many tables away a lookup chain is followed before it is left out unjudged. */
const MAX_CHAIN_DEPTH = 8

/** Who reads, through what, and how deep in a lookup chain the judgement is. */
interface LookupJudgement {
  readonly reader: CallerReader | undefined
  readonly db: DataSourceDb
  readonly refused: ReadonlySet<string>
  readonly depth?: number
}

/**
 * One lookup of a lookup's verdict for a page of rows ({@link chainedLookupLinksOf}):
 * the keys of the linked records whose copied field survives the visitor's
 * read of them — read, narrowed to that field, and judged through every link
 * they read in turn, as the records API judges them. `undefined` when the
 * chain cannot be judged by one record (it copies many linked rows, or runs
 * deeper than {@link MAX_CHAIN_DEPTH}): the lookup is then left out whole.
 */
async function clearedChainKeys(
  app: App,
  link: LookupLink,
  rows: readonly RecordRow[],
  ctx: LookupJudgement
): Promise<ReadonlySet<string> | undefined> {
  const depth = ctx.depth ?? 0
  if (link.road !== 'column' || depth >= MAX_CHAIN_DEPTH) return undefined
  const keys = [...new Set(rows.map((row) => linkKeyOf(row, link)))].filter(
    (key): key is string => key !== undefined
  )
  if (keys.length === 0) return new Set<string>()
  const relatedName = link.relatedTable.name
  const kept = new Set([
    'id',
    link.relatedField,
    ...lookupKeyColumnsFor(app, relatedName, [link.relatedField]),
  ])
  const linked = await ctx.db.fetchRecords(relatedName, {
    filter: [{ field: 'id', operator: 'in', value: keys }],
  })
  const judged = await withRowRuledLookupsHidden(
    app,
    relatedName,
    linked.map((row) => Object.fromEntries(Object.entries(row).filter(([k]) => kept.has(k)))),
    { ...ctx, refused: new Set<string>(), depth: depth + 1 }
  )
  return new Set(
    judged.filter((row) => Object.hasOwn(row, link.relatedField)).map((row) => String(row['id']))
  )
}

/** Does `link` hide its lookup on `row`, given its verdict for the page? */
function hidesOn(
  row: RecordRow,
  link: LookupLink,
  readable: ReadonlySet<string> | undefined
): boolean {
  if (readable === undefined) return false
  if (link.road !== 'column') return true
  if (!Object.hasOwn(row, link.relationship)) return true
  const key = linkKeyOf(row, link)
  return key !== undefined && !readable.has(key)
}

/**
 * `rows` with every lookup through a link to a row the related table's
 * row-level rule hides from the visitor left out, as the records API leaves it
 * out. A lookup through a key column is judged by its linked row; one that
 * copies many linked rows (many-to-many, or the link a related table holds) is
 * left out whole when a rule governs her there — a page has no recomputation
 * to narrow it with, and leaving it out never shows a hidden value. A lookup
 * of a lookup is judged through every record it reads, the one two tables
 * away included ({@link clearedChainKeys}). Every formula over a lookup left
 * out goes with it. Judged on the RAW rows: the column projection may drop
 * the key it is judged by — and a row that reached here without the key at
 * all cannot be judged, so its lookup is left out.
 */
export async function withRowRuledLookupsHidden(
  app: App,
  tableName: string,
  rows: readonly RecordRow[],
  ctx: LookupJudgement
): Promise<readonly RecordRow[]> {
  if (rows.length === 0 || ctx.reader?.isUnrestricted === true) return rows
  const carried = (link: LookupLink) =>
    !ctx.refused.has(link.lookup) &&
    rows.some((row) => namesLookup(app, tableName, new Set(Object.keys(row)), link.lookup))
  const links = lookupLinksOf(app, tableName).filter(
    (link) => link.relatedTable.rowLevelPermissions?.read?.when !== undefined && carried(link)
  )
  const chained = chainedLookupLinksOf(app, tableName).filter(carried)
  if (links.length === 0 && chained.length === 0) return rows
  const verdicts = await Promise.all([
    ...links.map(async (link) => [link, await readableLinkedKeys(app, link, rows, ctx)] as const),
    ...chained.map(
      async (link) =>
        [link, (await clearedChainKeys(app, link, rows, ctx)) ?? new Set<string>()] as const
    ),
  ])
  return rows.map((row) => {
    const hidden = new Set(
      verdicts
        .filter(([link, readable]) => hidesOn(row, link, readable))
        .map(([link]) => link.lookup)
    )
    return withoutLookups([row], withFormulasOver(app, tableName, hidden))[0] ?? row
  })
}
