/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure helpers for the publishing-workflow slug convention.
 *
 * US-PAGES-ACCESS-PUBLISHING-002 (slug-management) defines a
 * convention-over-configuration contract for collection pages:
 *
 *   - A table that declares a `slug` field and a `title` field gains
 *     CMS slug semantics — when a record is created without an explicit
 *     `slug`, the engine derives one from `title` in kebab-case.
 *   - Explicit slugs are validated against the slug format
 *     (`/^[a-z0-9]+(-[a-z0-9]+)*$/`). Mixed-case, whitespace, and special
 *     characters fail with HTTP 422 (FieldFormatError).
 *   - Uniqueness is enforced by the existing unique-constraint plumbing
 *     (`unique: [{ fields: ['slug'] }]` or field-level `unique: true`).
 *
 * The convention is intentionally narrow: only fields literally named
 * `slug` participate, only `single-line-text` fields qualify, and slug
 * derivation only fires when the source `title` field is also a
 * `single-line-text` so the convention cannot fire on unrelated tables.
 *
 * Pure functions, no side effects — see record-rules.ts for the
 * Effect-aware integration into the validation pipeline.
 */

const SLUG_FIELD_NAME = 'slug' as const
const SLUG_TITLE_SOURCE = 'title' as const

/**
 * Slug format regex.
 *
 * Permits lowercase ASCII letters, digits, and hyphens, requires the
 * value to start and end with an alphanumeric character, and forbids
 * consecutive hyphens. This matches the `slugify()` output deterministi-
 * cally so any slug derived from a title round-trips through validation.
 */
export const SLUG_FORMAT_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/

/**
 * Convert a free-form title into a slug.
 *
 * Strategy:
 *   1. Lowercase.
 *   2. Drop characters that are neither letters, digits, whitespace,
 *      nor existing hyphens (special characters → empty).
 *   3. Collapse whitespace runs into a single hyphen.
 *   4. Collapse repeated hyphens into one.
 *   5. Trim leading/trailing hyphens.
 *
 * The output always satisfies SLUG_FORMAT_REGEX or is empty (when the
 * input contains no slug-friendly characters at all).
 */
export function slugifyTitle(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** A field-shape predicate used by isSlugConvention/isTitleConvention. */
type FieldLike = { readonly name: string; readonly type: string }

/** True when `fields` includes a `slug: single-line-text` column. */
export function hasSlugConventionField(fields: readonly FieldLike[]): boolean {
  return fields.some((f) => f.name === SLUG_FIELD_NAME && f.type === 'single-line-text')
}

/** True when `fields` includes a `title: single-line-text` column. */
export function hasTitleConventionField(fields: readonly FieldLike[]): boolean {
  return fields.some((f) => f.name === SLUG_TITLE_SOURCE && f.type === 'single-line-text')
}

/**
 * Decide what slug value (if any) should be auto-derived for a given
 * record-create body. Returns:
 *   - the derived slug when the table participates in the convention
 *     AND the body did not include `slug` AND the body has a non-empty
 *     `title` from which a non-empty slug can be produced.
 *   - undefined otherwise (no auto-derivation — leave the body alone).
 *
 * Pure: no Effect, no DB roundtrip.
 */
export function deriveSlugFromBody(
  fields: readonly FieldLike[],
  body: Readonly<Record<string, unknown>>
): string | undefined {
  if (!hasSlugConventionField(fields) || !hasTitleConventionField(fields)) return undefined
  if (SLUG_FIELD_NAME in body) return undefined
  const title = body[SLUG_TITLE_SOURCE]
  if (typeof title !== 'string' || title.trim().length === 0) return undefined
  const derived = slugifyTitle(title)
  return derived.length > 0 ? derived : undefined
}

/**
 * Validate an explicit slug against SLUG_FORMAT_REGEX. Returns true when
 * the value matches; false otherwise. Empty strings fail (a slug with no
 * characters has no meaning for URL routing).
 */
export function isValidSlugFormat(value: string): boolean {
  return SLUG_FORMAT_REGEX.test(value)
}
