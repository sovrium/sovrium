/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react'
import { fetchLinkedLabels } from '../record-candidates'
import type { ListboxCandidate } from '../option-listbox'

/**
 * Resolve the ids a `relationship` field currently links to into the labels a
 * reader can actually read.
 *
 * A form seeded from an existing record holds foreign KEYS. Rendering those is
 * the defect this whole picker exists to fix — a read-only "Company" field
 * showing `1` tells the reader nothing, and a search box pre-filled with `1`
 * tells them something false.
 *
 * Two sources feed the same map, in this order:
 *
 *   1. **Candidates already on screen.** A row the search just returned carries
 *      its own label, so selecting it must never cost a second request.
 *   2. **A lookup for whatever is left.** Only ids no candidate has explained
 *      are fetched, and the fetch is keyed on exactly those ids.
 *
 * The effect is keyed on the JOINED unresolved ids rather than on the array, so
 * a re-render that produces an equal-but-new array does not cancel the request
 * it just issued and start it again — the shape that turns a resolved label
 * into a permanent spinner.
 */
export function useLinkedLabels(args: {
  readonly relatedTable: string | undefined
  readonly displayField: string | undefined
  readonly linkedIds: readonly string[]
  readonly candidates: readonly ListboxCandidate[]
}): Readonly<Record<string, string>> {
  const { relatedTable, displayField, linkedIds, candidates } = args
  const [fetched, setFetched] = useState<Readonly<Record<string, string>>>({})

  const fromCandidates = Object.fromEntries(candidates.map((c) => [c.value, c.label]))
  const known: Readonly<Record<string, string>> = { ...fetched, ...fromCandidates }
  const unresolved = linkedIds.filter((id) => known[id] === undefined)
  const unresolvedKey = unresolved.join(',')

  useEffect(() => {
    if (!relatedTable || unresolvedKey === '') return
    // An `AbortController` rather than a mutable `live` flag: the answer to
    // "has this effect been superseded?" is the signal's own state, so there is
    // no second variable that could disagree with it.
    const superseded = new AbortController()
    void fetchLinkedLabels({
      relatedTable,
      displayField,
      ids: unresolvedKey.split(','),
    }).then((resolved) => {
      if (superseded.signal.aborted) return
      setFetched((prev) => ({
        ...prev,
        ...Object.fromEntries(resolved.map((c) => [c.value, c.label])),
      }))
    })
    return () => superseded.abort()
    // `unresolvedKey` is the joined id list — a stable string standing in for
    // the array, so an equal set of ids does not re-issue the lookup.
  }, [relatedTable, displayField, unresolvedKey])

  return known
}
