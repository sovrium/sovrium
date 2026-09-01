/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The five campaign parameters, and the absent-vs-null rule that governs
 * editing them.
 *
 * Callers speak FLAT (`utmSource`, `utmMedium`, …) because that is the shape a
 * form posts and an automation step declares; storage is a single nested JSON
 * column. The mapping between the two lives here so both callers agree, and so
 * the merge semantics — which are the subtle part — have exactly one
 * implementation.
 */

/* eslint-disable unicorn/no-null -- `null` and `undefined` are DIFFERENT instructions here and both are
   load-bearing: `undefined` means "leave the column alone", `null` means "there is no campaign block" /
   "remove this parameter". The stored shape is `LinkUtmRecord | null` on the port, so collapsing the two
   would make a campaign parameter impossible to clear once set. */

import type { LinkUtmRecord } from '@/application/ports/repositories/links/link-repository'

/** Flat request field <-> stored utm key. */
export const UTM_FIELDS = [
  ['utmSource', 'source'],
  ['utmMedium', 'medium'],
  ['utmCampaign', 'campaign'],
  ['utmContent', 'content'],
  ['utmTerm', 'term'],
] as const

export type UtmKey = (typeof UTM_FIELDS)[number][1]

/**
 * A sparse edit of the campaign block.
 *
 * An ABSENT key leaves the parameter alone; an explicit `null` removes it. The
 * distinction is the same one the lifecycle columns carry, applied inside a
 * single JSON column, and collapsing it would make a campaign parameter
 * impossible to clear once set.
 */
export type LinkUtmPatch = Readonly<Partial<Record<UtmKey, string | null>>>

/**
 * Build the utm block a CREATE declares, or null when it declares none.
 *
 * Create has nothing to merge against, so a non-string value is simply not a
 * parameter rather than an instruction to remove one.
 */
export const utmRecordFromFlat = (
  body: Readonly<Record<string, unknown>>
): LinkUtmRecord | null => {
  const entries = UTM_FIELDS.map(([field, key]) => [key, body[field]] as const).filter(
    (entry): entry is readonly [UtmKey, string] => typeof entry[1] === 'string'
  )
  return entries.length === 0 ? null : (Object.fromEntries(entries) as LinkUtmRecord)
}

/**
 * Read a sparse utm patch out of a flat request body.
 *
 * Presence is decided by the KEY being in the body, not by its value being
 * useful: `{ utmTerm: null }` is an instruction to clear `term`, while a body
 * that never mentions `utmTerm` leaves it untouched. Anything that is not a
 * string reads as a removal, which is what makes `null`, and only `null`, the
 * documented way to clear one.
 *
 * Returns `undefined` when the body mentions no utm field at all, so the column
 * is left alone rather than rewritten with its own value.
 */
export const utmPatchFromFlat = (
  body: Readonly<Record<string, unknown>>
): LinkUtmPatch | undefined => {
  const entries = UTM_FIELDS.filter(([field]) => field in body).map(
    ([field, key]) =>
      [key, typeof body[field] === 'string' ? (body[field] as string) : null] as const
  )
  return entries.length === 0 ? undefined : (Object.fromEntries(entries) as LinkUtmPatch)
}

/**
 * Apply a patch to the stored block.
 *
 * Returns `undefined` for "no utm field was mentioned — leave the column
 * alone", and `null` when the merge empties the block, so that a link stripped
 * of its last parameter stores no campaign block rather than an empty object.
 */
export const mergeUtmPatch = (
  patch: LinkUtmPatch | undefined,
  existing: LinkUtmRecord | null
): LinkUtmRecord | null | undefined => {
  if (patch === undefined) return undefined

  const keys = Object.keys(patch) as readonly UtmKey[]
  if (keys.length === 0) return undefined

  const merged = keys.reduce<Record<string, string>>(
    (acc, key) => {
      const value = patch[key]
      if (typeof value === 'string') return { ...acc, [key]: value }
      const { [key]: _removed, ...rest } = acc
      return rest
    },
    { ...(existing ?? {}) } as Record<string, string>
  )

  return Object.keys(merged).length === 0 ? null : (merged as LinkUtmRecord)
}
