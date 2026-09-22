/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState } from 'react'
import type { ListboxCandidate } from './option-listbox'
import type { CreateRelatedOutcome } from './record-candidates'

/**
 * The inline-create row a picker offers when its search matches nothing.
 *
 * Split out of `fetching-picker.tsx` so that component stays inside the
 * `max-lines-per-function` and `complexity` ceilings, and because "when may we
 * offer to create this?" is a decision worth naming: it is the one place the
 * difference between "nothing matched" and "the search never landed" changes
 * what the reader is offered.
 */

/**
 * The key of the synthetic "create this" row.
 *
 * A control character, so it can never collide with a real record key — the
 * candidate list is keyed by primary key, and no table has an id of this shape.
 */
export const CREATE_KEY = '\0sovrium:create'

export interface PickerCreate {
  /** The candidate list, with the create row appended when one is offered. */
  readonly candidates: readonly ListboxCandidate[]
  /** The related table's own refusal, verbatim, when the last create failed. */
  readonly error: string | undefined
  /** Runs the create and reports the new key, or `undefined` on a refusal. */
  readonly run: () => Promise<string | undefined>
}

export function usePickerCreate(args: {
  readonly candidates: readonly ListboxCandidate[]
  readonly term: string
  readonly loading: boolean
  readonly failed: boolean
  readonly enabled: boolean
  readonly createFromTerm?: (term: string) => Promise<CreateRelatedOutcome>
}): PickerCreate {
  const { candidates, term, loading, failed, enabled, createFromTerm } = args
  const [error, setError] = useState<string | undefined>(undefined)

  // Offered only when the search has SETTLED on nothing. A still-loading list
  // has not yet failed to match, and a failed one never searched at all, so
  // offering to create from either answers a question nobody asked.
  const alreadyExists = candidates.some(
    (candidate) => candidate.label.toLowerCase() === term.toLowerCase()
  )
  const offers =
    enabled && createFromTerm !== undefined && term !== '' && !loading && !failed && !alreadyExists

  return {
    candidates: offers
      ? [...candidates, { value: CREATE_KEY, label: `Create '${term}'` }]
      : candidates,
    error,
    run: async () => {
      const outcome = await createFromTerm?.(term)
      if (outcome === undefined) return undefined
      // A refusal is REPORTED, never worked around: the related table's own
      // rules said no, and half-creating past them leaves an orphan row behind.
      if (!outcome.ok) {
        setError(outcome.message)
        return undefined
      }
      setError(undefined)
      return outcome.id
    },
  }
}
