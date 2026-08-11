/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Seed-file reference tokens: `@table.key` and `@asset:filename`.
 *
 * ## Why references exist at all
 *
 * Link fields take numeric record ids and nothing else — there is no slug
 * lookup and no nested create. A seed file therefore cannot write
 * `company: "Acme Corp"`; it must write the id the database assigned, which
 * nobody knows until the row is inserted. Hard-coding ids instead makes the
 * data set unreplayable the moment anything upstream shifts — the exact
 * fragility Rails fixtures solved with labels and Strapi's import/export
 * documents as "relying on the ID of an entry is not reliable".
 *
 * So every seed row declares a `key:` — a natural name, stable across runs and
 * meaningful to a human reading the file — and other rows reference it. The
 * command resolves keys to ids internally, in dependency order.
 *
 * ## Why the `@` sigil, rather than a bare key
 *
 * A bare `company: acme` is ambiguous: `acme` is a perfectly good literal
 * string, and a link field that silently reinterpreted it as a reference would
 * be unguessable. The sigil makes the intent explicit and greppable. A literal
 * value that must genuinely begin with `@` — an email-shaped handle, say — is
 * escaped as `\@`.
 *
 * ## Why an unrecognised `@…` is an error
 *
 * `@companies.acme` and `@compnaies.acme` differ by a typo. Treating the second
 * as a literal string would store the text `@compnaies.acme` in an integer
 * foreign key column, and the failure surfaces as a driver-level type error
 * pointing at a column rather than at the misspelling. Refusing here names the
 * file, the row, and the available keys.
 */

/** A resolved-at-parse-time reference to another seed row. */
export interface SeedReference {
  readonly table: string
  readonly key: string
}

/** Prefix that escapes a literal value which really does start with `@`. */
const ESCAPE_PREFIX = '\\'

/**
 * `@<table>.<key>`.
 *
 * Table names follow the database-identifier rule already enforced on
 * `Table.name`; keys follow {@link SEED_KEY_PATTERN}. Anchored at both ends so
 * a reference is the whole value, never embedded in prose — a half-string
 * reference has no sensible meaning in a foreign key.
 */
const REFERENCE_PATTERN = /^@([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z0-9][A-Za-z0-9_-]*)$/

/**
 * `@asset:<filename>`. The filename is resolved relative to `seed/assets/` and
 * may not escape it — `..` and absolute paths are refused, because a seed file
 * is data and must never be able to read an arbitrary path on the host that
 * runs the nightly reset.
 */
const ASSET_PATTERN = /^@asset:([A-Za-z0-9][A-Za-z0-9._-]*)$/

/** The shape a seed row's `key:` must take. */
export const SEED_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/

/** Parse `@table.key`, or `undefined` when the string is not that shape. */
export const parseSeedReference = (raw: string): SeedReference | undefined => {
  const match = REFERENCE_PATTERN.exec(raw)
  if (!match) return undefined
  const table = match[1]
  const key = match[2]
  if (table === undefined || key === undefined) return undefined
  return { table, key }
}

/** Parse `@asset:name.ext` into the bare filename, or `undefined`. */
export const parseAssetReference = (raw: string): string | undefined => {
  const match = ASSET_PATTERN.exec(raw)
  return match?.[1]
}

/**
 * True when the value carries the reference sigil unescaped — i.e. the author
 * meant a reference. A `true` here with both parsers returning `undefined` is a
 * malformed reference and must be refused, not stored.
 */
export const looksLikeReference = (raw: string): boolean =>
  !raw.startsWith(ESCAPE_PREFIX) && raw.startsWith('@')

/** Classification of one string-valued seed field. */
export type ReferenceToken =
  | { readonly kind: 'record'; readonly reference: SeedReference }
  | { readonly kind: 'asset'; readonly filename: string }
  | { readonly kind: 'literal'; readonly value: string }
  | { readonly kind: 'invalid'; readonly reason: string }

/**
 * Classify one string value.
 *
 * Asset references are tested before record references because both begin with
 * `@`; `@asset:` is reserved and can never be a table named `asset`, since a
 * record reference requires a `.` separator and an asset requires `:`.
 */
export const classifyReferenceToken = (raw: string): ReferenceToken => {
  if (raw.startsWith(ESCAPE_PREFIX)) {
    return { kind: 'literal', value: raw.slice(ESCAPE_PREFIX.length) }
  }
  if (!raw.startsWith('@')) return { kind: 'literal', value: raw }

  const asset = parseAssetReference(raw)
  if (asset !== undefined) return { kind: 'asset', filename: asset }

  const reference = parseSeedReference(raw)
  if (reference !== undefined) return { kind: 'record', reference }

  return {
    kind: 'invalid',
    reason:
      `Unrecognised reference "${raw}". ` +
      `Expected @<table>.<key> (e.g. @companies.acme) or @asset:<filename> ` +
      `(e.g. @asset:logo.avif). ` +
      `To store this text literally, escape it as "\\${raw}".`,
  }
}
