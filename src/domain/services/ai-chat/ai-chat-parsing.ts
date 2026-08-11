/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * AI Chat — shared natural-language parsing primitives.
 *
 * Both the mutation parser ({@link import('./ai-chat-mutation-parser')}) and
 * the query parser ({@link import('./ai-chat-query-parser')}) derive a
 * structured intent from a free-text chat message. They share three pieces of
 * deterministic extraction logic — table-name resolution, select-option
 * detection, and the quoted-literal regex — which previously each carried its
 * own near-identical copy. This module is the single source of truth so a
 * tweak to the matching heuristics is made once.
 *
 * Everything here is pure (no I/O, no app dependency) and structural (it reads
 * only the minimal `{ name }` / `{ name, options? }` shapes) so it stays in the
 * domain layer alongside the two parsers it serves.
 */

/**
 * A quoted token (single or double quotes) — captures a literal value the user
 * supplied for a field even when it is malformed (e.g. an invalid email
 * `"not-valid"`), so the executor's schema validation can still reject it.
 */
export const QUOTED_RE = /["']([^"']+)["']/

/** Lowercase and collapse hyphens/underscores to single spaces. */
export const normaliseSeparators = (raw: string): string => raw.toLowerCase().replace(/[-_]+/g, ' ')

/** Minimal table shape table-name resolution reads. */
export interface NamedTable {
  readonly name: string
}

/**
 * Resolve which table a message refers to: the first table whose (plural or
 * singular) name appears as a substring of the message.
 *
 * Both the table name and the message are normalised (lowercased, separators
 * collapsed) so a hyphen/underscore in a table name ("admin-logs") still
 * matches a space-separated phrase ("show admin logs"), and a plural table name
 * still matches its singular form ("contacts" → "contact").
 */
export const findReferencedTable = <T extends NamedTable>(
  message: string,
  tables: ReadonlyArray<T>
): T | undefined => {
  const lower = normaliseSeparators(message)
  return tables.find((table) => {
    const name = normaliseSeparators(table.name)
    const singular = name.endsWith('s') ? name.slice(0, -1) : name
    return lower.includes(name) || lower.includes(singular)
  })
}

/** Minimal field shape select-option detection reads. */
export interface OptionableField {
  readonly name: string
  /** Predefined option values for single-select / multi-select fields. */
  readonly options?: ReadonlyArray<string>
}

/** A select-option mention: the owning field and the matched option value. */
export interface SelectOptionMention {
  readonly field: string
  readonly value: string
}

/**
 * Escape regex metacharacters before building a word-boundary test. `$&`
 * (the whole match) is the correct back-reference here — the metacharacter
 * set is a character class with no capture group, so `$1` would be emitted
 * literally and leave the option value un-escaped.
 */
const escapeRegExp = (raw: string): string => raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Find a single-select option value mentioned in the message. Returns the
 * owning field and the matched option (e.g. "open tickets" →
 * `{ field: 'status', value: 'open' }`), or `undefined` when no option of any
 * field is mentioned.
 *
 * Matching is word-boundary-anchored so an option value never matches inside a
 * larger word, and option values are regex-escaped so a metacharacter in an
 * option literal is matched verbatim.
 */
export const findSelectOptionMention = (
  message: string,
  fields: ReadonlyArray<OptionableField>
): SelectOptionMention | undefined => {
  const lower = message.toLowerCase()
  return fields
    .flatMap((field) =>
      (field.options ?? [])
        .filter((opt) => new RegExp(`\\b${escapeRegExp(opt.toLowerCase())}\\b`).test(lower))
        .map((value) => ({ field: field.name, value }))
    )
    .at(0)
}
