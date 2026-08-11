/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react'
import type { ListboxCandidate } from './option-listbox'

/**
 * Search state for the two pickers that fetch their candidates.
 *
 * Both the record picker and the user picker do the same thing — take a typed
 * term, ask the server for a capped page of matches, and hand a candidate list
 * to the shared listbox — so the term, the debounce, the in-flight guard and
 * the failure handling live here once rather than twice.
 *
 * The cap is applied SERVER-SIDE by both callers. A 10k-row related table is
 * handled by never fetching it: an empty term asks for the first page rather
 * than for everything, so the picker's cost does not depend on the table's size.
 */

/** How long typing settles before a request goes out. */
const SEARCH_DEBOUNCE_MS = 200

export interface CandidateSearch {
  readonly term: string
  readonly setTerm: (next: string) => void
  readonly candidates: readonly ListboxCandidate[]
  readonly loading: boolean
  readonly failed: boolean
}

export function useCandidateSearch(
  fetchCandidates: (term: string, signal: AbortSignal) => Promise<readonly ListboxCandidate[]>,
  /** Re-runs the search when this changes — the endpoint or table it targets. */
  sourceKey: string
): CandidateSearch {
  const [term, setTerm] = useState('')
  const [candidates, setCandidates] = useState<readonly ListboxCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(
      () => {
        setLoading(true)
        fetchCandidates(term, controller.signal)
          .then((next) => {
            setCandidates(next)
            setFailed(false)
          })
          .catch(() => {
            // An aborted request is a superseded keystroke, not a failure. Any
            // other rejection leaves the list empty, and `failed` is what stops
            // the listbox reporting "no matches" for a request that never landed.
            if (!controller.signal.aborted) setFailed(true)
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false)
          })
        // The first fetch is immediate: the picker opens on a double-click, and
        // waiting out a typing debounce before showing ANY candidate would make
        // the control look empty at the moment it appears.
      },
      term === '' ? 0 : SEARCH_DEBOUNCE_MS
    )

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [term, sourceKey, fetchCandidates])

  return { term, setTerm, candidates, loading, failed }
}
