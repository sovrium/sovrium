/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium import` — how a planned entry meets the config it is written into.
 * A name the config does not hold is added; a name it holds with exactly the
 * same content is a re-run of the same import and changes nothing; a name it
 * holds with other content is a clash, refused before anything is written.
 */

import { refuse } from '@/cli/commands/app-prelude'
import type { ConfigEntry } from '@/domain/models/import/table-mapper-service'

type Json = Readonly<Record<string, unknown>>

/** The object entries of a root key of the config. */
export const listOf = (parsed: unknown, key: string): readonly Json[] => {
  const items = (parsed as Json | undefined)?.[key]
  return Array.isArray(items)
    ? items.filter((item): item is Json => typeof item === 'object' && item !== null)
    : []
}

/** An entry's content, its id aside: ids are renumbered, content is what a clash compares. */
export const withoutId = (entry: Json): string => {
  const { id: _id, ...rest } = entry
  return JSON.stringify(rest)
}

/**
 * Split planned entries into the ones to add and the ones the config already
 * holds unchanged; a name the config holds with OTHER content is a clash.
 */
export const partition = (
  planned: readonly ConfigEntry[],
  existing: readonly Json[],
  identity: (entry: Json) => string
): { readonly add: readonly ConfigEntry[]; readonly clashes: readonly string[] } => {
  const byName = new Map(existing.map((entry) => [String(entry['name']), entry] as const))
  return planned.reduce<{
    readonly add: readonly ConfigEntry[]
    readonly clashes: readonly string[]
  }>(
    (state, entry) => {
      const held = byName.get(String(entry['name']))
      if (held === undefined) return { ...state, add: [...state.add, entry] }
      return identity(held) === identity(entry)
        ? state
        : { ...state, clashes: [...state.clashes, String(entry['name'])] }
    },
    { add: [], clashes: [] }
  )
}

/** Refuse the run when a planned entry clashes with one the config holds. */
export const refuseClashes = (
  kind: 'table' | 'automation' | 'form' | 'bucket',
  clashes: readonly string[]
): void => {
  if (clashes.length === 0) return
  const plural = clashes.length > 1
  refuse(
    `Error: The config already has ${plural ? `${kind}s` : `a ${kind}`} named ${clashes.map((name) => `"${name}"`).join(', ')}, ` +
      'so the import changed nothing.\n\n' +
      (kind === 'bucket'
        ? '  An import never merges into or overwrites an existing bucket. Rename the existing bucket first.'
        : `  An import never merges into or overwrites an existing ${kind}. Import under new names with --prefix <p>,\n` +
          `  e.g. --prefix ${kind === 'automation' ? 'n8n-' : 'imported_'}, or rename the existing ${kind} first.`)
  )
}
