/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One seed field value, classified before any database id exists.
 *
 * Planning and writing are deliberately two phases. A `@table.key` reference
 * cannot become a number until the referenced row has been inserted, and the
 * refusal catalogue in `[internal ref]` demands that a malformed token or
 * an unresolvable key be reported *before* anything is written — a refusal
 * raised halfway through a data set leaves the retry looking at a non-empty
 * table, and `--mode if-empty` then skips it forever.
 *
 * So this module turns raw YAML scalars into a closed set of intents, and the
 * writer resolves those intents against ids it has just observed.
 */

import { classifyReferenceToken, expandSeedStringValue } from '@/domain/models/seed'

/** A symbolic pointer at another seed row. */
export interface SeedRef {
  readonly table: string
  readonly key: string
}

/** A planned field value: literal data, one link, a link list, or a binary. */
export type SeedValue =
  | { readonly kind: 'literal'; readonly value: unknown }
  | { readonly kind: 'ref'; readonly ref: SeedRef }
  | { readonly kind: 'refs'; readonly refs: readonly SeedRef[] }
  | { readonly kind: 'asset'; readonly filename: string }

/** Either a planned value or the reason it cannot be planned. */
export type SeedValueOutcome =
  { readonly ok: true; readonly value: SeedValue } | { readonly ok: false; readonly reason: string }

/** Prefix that escapes a literal value which really starts with `@` or `{{`. */
const ESCAPE_PREFIX = '\\'

/**
 * Plan one *string* value.
 *
 * The escape check runs first and once. Both grammars spell their escape `\`,
 * so letting `classifyReferenceToken` strip it and then handing the remainder
 * to `expandSeedStringValue` would make `\{{not a token}}` fail as a malformed
 * token — the value the author escaped precisely to avoid that.
 *
 * References are classified before tokens because a reference is opaque to the
 * date grammar (`@companies.acme` contains no `{{`), whereas the reverse is not
 * true: an expanded date is a plain string that must not then be re-read as a
 * reference.
 */
const planString = (raw: string, runAt: Readonly<Date>): SeedValueOutcome => {
  if (raw.startsWith(ESCAPE_PREFIX)) {
    return { ok: true, value: { kind: 'literal', value: raw.slice(ESCAPE_PREFIX.length) } }
  }

  const token = classifyReferenceToken(raw)
  if (token.kind === 'record') return { ok: true, value: { kind: 'ref', ref: token.reference } }
  if (token.kind === 'asset')
    return { ok: true, value: { kind: 'asset', filename: token.filename } }
  if (token.kind === 'invalid') return { ok: false, reason: token.reason }

  const expanded = expandSeedStringValue(raw, runAt)
  return expanded.ok
    ? { ok: true, value: { kind: 'literal', value: expanded.value } }
    : { ok: false, reason: expanded.reason }
}

/** The first refusal among planned elements, or the planned elements. */
const planElements = (
  raw: readonly unknown[],
  runAt: Readonly<Date>
): { readonly reason: string } | { readonly values: readonly SeedValue[] } => {
  const outcomes = raw.map((element) => planSeedValue(element, runAt))
  const failure = outcomes.find((outcome) => !outcome.ok)
  if (failure && !failure.ok) return { reason: failure.reason }
  return {
    values: outcomes.flatMap((outcome) => (outcome.ok ? [outcome.value] : [])),
  }
}

/**
 * Plan any seed field value.
 *
 * An array whose elements are *all* references becomes a single `refs` intent —
 * the shape a `many-to-many` field needs. A mixed array is kept literal: a link
 * list that is only partly symbolic has no coherent meaning, and silently
 * dropping the literal half is exactly the "well-formed, confident and wrong"
 * outcome the refusal catalogue exists to prevent (the writer refuses it when
 * the target column turns out to be a link).
 */
export const planSeedValue = (raw: unknown, runAt: Readonly<Date>): SeedValueOutcome => {
  if (typeof raw === 'string') return planString(raw, runAt)
  if (!Array.isArray(raw)) return { ok: true, value: { kind: 'literal', value: raw } }

  const planned = planElements(raw, runAt)
  if ('reason' in planned) return { ok: false, reason: planned.reason }

  const refs = planned.values.flatMap((value) => (value.kind === 'ref' ? [value.ref] : []))
  if (refs.length > 0 && refs.length === planned.values.length) {
    return { ok: true, value: { kind: 'refs', refs } }
  }
  return {
    ok: true,
    value: {
      kind: 'literal',
      value: planned.values.map((value) => (value.kind === 'literal' ? value.value : undefined)),
    },
  }
}

/** Every reference a planned value points at (one, many, or none). */
export const referencesOf = (value: SeedValue): readonly SeedRef[] =>
  value.kind === 'ref' ? [value.ref] : value.kind === 'refs' ? value.refs : []
