/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


const SLUG_FIELD_NAME = 'slug' as const
const SLUG_TITLE_SOURCE = 'title' as const

export const SLUG_FORMAT_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function slugifyTitle(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

type FieldLike = { readonly name: string; readonly type: string }

export function hasSlugConventionField(fields: readonly FieldLike[]): boolean {
  return fields.some((f) => f.name === SLUG_FIELD_NAME && f.type === 'single-line-text')
}

export function hasTitleConventionField(fields: readonly FieldLike[]): boolean {
  return fields.some((f) => f.name === SLUG_TITLE_SOURCE && f.type === 'single-line-text')
}

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

export function isValidSlugFormat(value: string): boolean {
  return SLUG_FORMAT_REGEX.test(value)
}
