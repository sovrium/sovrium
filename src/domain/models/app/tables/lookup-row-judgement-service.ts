/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A row's verdict on each lookup a reader's read of it judges: kept as the
 * database computed it, hidden from her, or — for a lookup of a lookup that
 * copies a list — replaced by the list her own read of the linked record
 * carries. Pure: the reads that decide each verdict are the caller's.
 */

import { withFormulasOver, type LookupLink } from './lookup-link-service'
import type { App } from '@/domain/models/app'

/** The keys a relationship value names: a bare key, a `{ id }` object, or a list of either. */
export const keysOf = (value: unknown): readonly string[] => {
  if (value === null || value === undefined) return []
  if (Array.isArray(value)) return value.flatMap(keysOf)
  if (typeof value === 'object') {
    const { id, value: inner } = value as { readonly id?: unknown; readonly value?: unknown }
    if (id !== undefined) return keysOf(id)
    return inner === undefined ? [] : keysOf(inner)
  }
  return [String(value)]
}

/**
 * A row's verdict on one lookup: kept as stored, hidden, or replaced by the
 * value her own read of the linked record carries (a narrowed list).
 */
export type Judgement = 'kept' | 'hidden' | { readonly narrowed: unknown }
export type RowVerdict<Row> = (row: Row) => Judgement

/** The verdict of a link that cannot be judged by one record: hidden on every row. */
export const hiddenOnEveryRow = (): Judgement => 'hidden'

/**
 * The linked keys whose copied value survives a reader's read as stored, and
 * those whose value survives narrowed; any other key hides it.
 */
export interface ClearedKeys {
  readonly kept: ReadonlySet<string>
  readonly narrowed: ReadonlyMap<string, unknown>
}

/**
 * The verdict of a link whose readable keys are `allowed`: a row linking to any
 * other key hides the lookup; `undefined` (no rule governs the reader) hides
 * nothing.
 */
export const hiddenOutside =
  <Row extends Readonly<Record<string, unknown>>>(
    link: LookupLink,
    allowed: ReadonlySet<string> | undefined
  ): RowVerdict<Row> =>
  (row) =>
    allowed !== undefined && keysOf(row[link.relationship]).some((key) => !allowed.has(key))
      ? 'hidden'
      : 'kept'

/**
 * The verdict of a lookup of a lookup: kept where every linked record keeps the
 * value as stored, narrowed as its one linked record narrows it, else hidden.
 */
export const judgedByLinked =
  <Row extends Readonly<Record<string, unknown>>>(
    link: LookupLink,
    cleared: ClearedKeys
  ): RowVerdict<Row> =>
  (row) => {
    const keys = keysOf(row[link.relationship])
    if (keys.every((key) => cleared.kept.has(key))) return 'kept'
    const [only] = keys
    if (keys.length !== 1 || only === undefined || !cleared.narrowed.has(only)) return 'hidden'
    const stored = row[link.lookup]
    return stored === null || stored === undefined
      ? 'kept'
      : { narrowed: cleared.narrowed.get(only) }
  }

/**
 * `row` less every lookup a verdict hides, with every lookup a verdict narrows
 * replaced by its narrowed value — and less every formula over either: the
 * database computed it over the value as stored.
 */
export const applyJudgements = <Row extends Readonly<Record<string, unknown>>>(
  app: App,
  tableName: string,
  row: Row,
  verdicts: readonly (readonly [LookupLink, RowVerdict<Row>])[]
): Row => {
  const judged = verdicts.map(([link, verdict]) => [link.lookup, verdict(row)] as const)
  const hiddenLookups = judged.filter(([, verdict]) => verdict === 'hidden').map(([name]) => name)
  const narrowed = new Map(
    judged.flatMap(([name, verdict]) =>
      typeof verdict === 'object' ? [[name, verdict.narrowed] as const] : []
    )
  )
  if (hiddenLookups.length === 0 && narrowed.size === 0) return row
  const formulas = withFormulasOver(app, tableName, new Set([...hiddenLookups, ...narrowed.keys()]))
  const hidden = new Set([...hiddenLookups, ...[...formulas].filter((n) => !narrowed.has(n))])
  return Object.fromEntries(
    Object.entries(row)
      .filter(([name]) => !hidden.has(name))
      .map(([name, value]) => [name, narrowed.has(name) ? narrowed.get(name) : value])
  ) as Row
}
