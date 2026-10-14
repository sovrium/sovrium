/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'
import { clearFacet, toggleFacetValue, type FacetSelections } from './facet-filters'

/**
 * The faceted filters' checked values. Transient like the filter builder:
 * held for the visit, stored nowhere.
 */
export function useFacetState() {
  const [facetSelections, setFacetSelections] = useState<FacetSelections>({})
  const onToggleFacetValue = useCallback(
    (field: string, value: string) =>
      setFacetSelections((prev) => toggleFacetValue(prev, field, value)),
    []
  )
  const onClearFacet = useCallback(
    (field: string) => setFacetSelections((prev) => clearFacet(prev, field)),
    []
  )
  return { facetSelections, onToggleFacetValue, onClearFacet }
}
