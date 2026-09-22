/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The records-API reads a `relationship` picker needs, in ONE place.
 *
 * Two surfaces render a picker for the same `relationship` column — the grid's
 * cell editor and the standalone `form` — and this module exists because they
 * had drifted to the point where only one of them was a picker at all. Putting
 * the candidate query, the row→candidate mapping and the id→label lookup here
 * means the two surfaces cannot disagree about which column is searched, how a
 * row with an empty display column is labelled, or what a page of candidates
 * costs.
 *
 * Every read goes through the EXISTING `/api/tables/:table/records` endpoint,
 * with its own RBAC and field-level gating. No picker-specific endpoint is
 * introduced, and none is needed: a picker's candidate set is exactly a
 * permission-filtered read of the related table.
 */

import { buildSortParam, toApiConditions } from '../hooks/use-records-query'
import type { ListboxCandidate } from './option-listbox'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'

/** Server-side page size for candidates. A picker is a shortlist, not a table. */
export const CANDIDATE_LIMIT = 20

/** The subset of a records-API row a picker reads. */
export interface RecordRow {
  readonly id?: unknown
  readonly fields?: Readonly<Record<string, unknown>>
  readonly [key: string]: unknown
}

/** One page of the records API's list response, as a picker reads it. */
export interface RecordsPageBody {
  readonly records?: readonly RecordRow[]
  readonly pagination?: { readonly hasNextPage?: boolean; readonly total?: number }
}

/**
 * How a picker NARROWS and PAGES its candidate set, beyond the typed term.
 *
 * Every one of these travels in the URL and is therefore enforced by the
 * ordinary records route. That is the point rather than an implementation
 * detail: a filter applied only in the island is a filter that does not exist,
 * because anyone can edit a request.
 */
export interface CandidateScope {
  /** Conditions narrowing which rows can be found AT ALL. AND logic. */
  readonly filter?: readonly DataFilter[]
  /** Sort rules applied in order — omit at the cost of a non-deterministic order. */
  readonly sort?: readonly DataSort[]
  /** How many candidates one page holds. Defaults to {@link CANDIDATE_LIMIT}. */
  readonly pageSize?: number
}

/**
 * The candidates URL for one search term and page.
 *
 * The term is filtered SERVER-SIDE on the declared `displayField`, so a 10k-row
 * related table costs one capped page rather than a full read. A field with no
 * `displayField` offers ids unfiltered — guessing a searchable column would make
 * the query shape depend on the related table's width and could match on a
 * column the caller may not read.
 */
export function buildCandidatesUrl(args: {
  readonly relatedTable: string
  readonly displayField: string | undefined
  readonly term: string
  readonly page: number
  readonly scope?: CandidateScope
}): string {
  const { relatedTable, displayField, term, page } = args
  const scope = args.scope ?? {}
  const params = new URLSearchParams({
    limit: String(scope.pageSize ?? CANDIDATE_LIMIT),
    sort: buildSortParam(scope.sort) ?? 'id:asc',
    page: String(page),
  })
  // The author's conditions and the typed term share ONE `and` group, so the
  // scope is enforced on the first page and on every keystroke after it — and
  // a caller replaying this exact request cannot widen the candidate set past
  // it, because the narrowing is in the URL the SERVER reads.
  const searchCondition =
    displayField && term.trim() !== ''
      ? [{ field: displayField, operator: 'contains', value: term.trim() }]
      : []
  const conditions = [...toApiConditions(scope.filter), ...searchCondition]
  if (conditions.length > 0) params.set('filter', JSON.stringify({ and: conditions }))
  return `/api/tables/${encodeURIComponent(relatedTable)}/records?${params.toString()}`
}

/**
 * A records-API row as a listbox candidate.
 *
 * A row whose display column is empty still has to be pickable, and its key is
 * the only thing left that identifies it — so the key is the label of last
 * resort rather than a blank row nobody can aim at.
 */
export function rowToCandidate(row: RecordRow, displayField: string | undefined): ListboxCandidate {
  const flat = { ...row, ...(row.fields ?? {}) }
  const key = String(flat['id'] ?? '')
  const label = displayField ? flat[displayField] : undefined
  return { value: key, label: label === undefined || label === null ? key : String(label) }
}

/**
 * Fetch one capped page of candidates for a term.
 *
 * Throws on a non-OK response rather than returning an empty page: the search
 * hook reports a FAILED load distinctly from an empty one, and collapsing the
 * two would tell the reader "no matching records" for a request that never
 * landed.
 */
export async function fetchCandidatePage(args: {
  readonly relatedTable: string
  readonly displayField: string | undefined
  readonly term: string
  readonly page: number
  readonly signal: AbortSignal
  readonly scope?: CandidateScope
}): Promise<{
  readonly candidates: readonly ListboxCandidate[]
  readonly hasMore: boolean
  readonly total: number | undefined
}> {
  const { relatedTable, displayField, term, page, signal, scope } = args
  const url = buildCandidatesUrl({
    relatedTable,
    displayField,
    term,
    page,
    ...(scope && { scope }),
  })
  const res = await fetch(url, {
    signal,
    credentials: 'include',
  })
  if (!res.ok) {
    // eslint-disable-next-line functional/no-throw-statements -- The search hook reports a failed load distinctly from an empty one.
    throw new Error(`Failed to load ${relatedTable} candidates: ${res.status}`)
  }
  const body = (await res.json()) as RecordsPageBody
  return {
    candidates: (body.records ?? []).map((row) => rowToCandidate(row, displayField)),
    hasMore: body.pagination?.hasNextPage === true,
    total: body.pagination?.total,
  }
}

/**
 * Resolve linked ids to their display labels.
 *
 * A form loading an existing record holds foreign KEYS; a reader needs the
 * `displayField` value.
 *
 * Ids that resolve to nothing are returned labelled by their own key rather
 * than dropped: a link to a row the caller cannot read must still be visible as
 * a link, or removing it becomes impossible. That per-id fallback is why each
 * record is read on its OWN endpoint: one filtered list read cannot tell "this
 * id does not exist" from "you may not read it", and both have to survive as a
 * removable chip.
 *
 * The cost is therefore one request PER LINK, issued in parallel — bounded in
 * practice by `maxLinked` and by how many links a form carries, but a fan-out
 * rather than a batched read. Collapsing it into a single `id`-filtered list
 * read would be a real improvement AND a behaviour change (it alters what an
 * unreadable link shows), so it wants its own measurement and its own spec.
 */
export async function fetchLinkedLabels(args: {
  readonly relatedTable: string
  readonly displayField: string | undefined
  readonly ids: readonly string[]
}): Promise<readonly ListboxCandidate[]> {
  const { relatedTable, displayField, ids } = args
  if (ids.length === 0) return []
  const settled = await Promise.all(
    ids.map(async (id): Promise<ListboxCandidate> => {
      const fallback: ListboxCandidate = { value: id, label: id }
      try {
        const res = await fetch(
          `/api/tables/${encodeURIComponent(relatedTable)}/records/${encodeURIComponent(id)}`,
          { credentials: 'include' }
        )
        if (!res.ok) return fallback
        return rowToCandidate((await res.json()) as RecordRow, displayField)
      } catch {
        return fallback
      }
    })
  )
  return settled
}

/** What an inline create came back with: the new key, or the refusal to show. */
export type CreateRelatedOutcome =
  { readonly ok: true; readonly id: string } | { readonly ok: false; readonly message: string }

/** The canonical error envelope, as much of it as a refusal message needs. */
interface ErrorEnvelope {
  readonly message?: string
  readonly errors?: readonly { readonly message?: string }[]
}

/**
 * The most specific thing the server said about a refusal.
 *
 * The FIELD-LEVEL entry first: the envelope's summary says "Validation failed",
 * while `errors[0].message` names the column that blocked the create — the only
 * version a reader can act on.
 */
function refusalMessage(body: unknown): string {
  const envelope = body as ErrorEnvelope | undefined
  return envelope?.errors?.[0]?.message ?? envelope?.message ?? 'Could not create the record'
}

/** The id of a record the create endpoint just returned, at root or under `fields`. */
function createdId(body: unknown): string {
  const created = body as RecordRow | undefined
  return String({ ...(created ?? {}), ...(created?.fields ?? {}) }['id'] ?? '')
}

/**
 * Create a related record from the text the reader typed, and return its id.
 *
 * Posts `{ [displayField]: term }` to the EXISTING create endpoint, so the
 * related table's own required-column, format and permission rules judge the
 * write — no second validation is written here, the existing one is READ.
 */
export async function createRelatedRecord(args: {
  readonly relatedTable: string
  readonly displayField: string | undefined
  readonly term: string
}): Promise<CreateRelatedOutcome> {
  const { relatedTable, displayField, term } = args
  if (!displayField) {
    return { ok: false, message: 'This field declares no display column to create by' }
  }
  const res = await fetch(`/api/tables/${encodeURIComponent(relatedTable)}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ fields: { [displayField]: term } }),
  })
  const body: unknown = await res.json().catch(() => undefined)
  return res.ok ? { ok: true, id: createdId(body) } : { ok: false, message: refusalMessage(body) }
}
