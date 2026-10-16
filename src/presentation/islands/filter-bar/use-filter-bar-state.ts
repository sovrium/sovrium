/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildFilterExpression,
  parseFilterExpression,
} from '@/presentation/design/filter-expression'
import {
  usePublishedValueInAddress,
  useSharedFilterPublisher,
} from '../hooks/use-shared-filter-publisher'
import type { FilterBarCondition, FilterBarField } from '@/presentation/design/filter-expression'
import type { KeyboardEvent } from 'react'

/**
 * The condition set the bar is holding, the expression it publishes, and the
 * two edits a reader can make to it.
 *
 * The publish runs as an EFFECT on the expression rather than inside each edit
 * handler, so the opening conditions are published on mount by the same path
 * that publishes an edit — one channel with one code path, instead of a mount
 * case that can drift from the edit case.
 *
 * With `url` the expression is also mirrored in the page address, as
 * `?<channel>.filter=`, and a page opened on such an address starts from the
 * conditions it carries rather than from the declared opening ones.
 */
export function useFilterBarState({
  bindTo,
  url,
  fields,
  combinator,
  initialConditions,
}: {
  readonly bindTo: string
  readonly url: boolean
  readonly fields: readonly FilterBarField[]
  readonly combinator: 'and' | 'or'
  readonly initialConditions: readonly FilterBarCondition[] | undefined
}) {
  const publishes = { bindTo, param: 'filter', url }
  const restored = usePublishedValueInAddress(publishes)
  const [conditions, setConditions] = useState<readonly FilterBarCondition[]>(() =>
    typeof restored === 'string' && restored !== ''
      ? parseFilterExpression(restored)
      : (initialConditions ?? [])
  )
  const [open, setOpen] = useState(false)

  const expression = useMemo(
    () => buildFilterExpression(conditions, fields, combinator),
    [conditions, fields, combinator]
  )

  // A fresh object literal per render is deliberate and free: the hook memoizes
  // on `bindTo` / `param` (both primitives), not on the object's identity.
  const publish = useSharedFilterPublisher(publishes)
  useEffect(() => {
    publish(expression)
  }, [publish, expression])

  const removeAt = useCallback((index: number) => {
    setConditions((previous) => previous.filter((_condition, at) => at !== index))
  }, [])

  const addCondition = useCallback((condition: FilterBarCondition) => {
    setConditions((previous) => [...previous, condition])
    setOpen(false)
  }, [])

  const toggleOpen = useCallback(() => setOpen((previous) => !previous), [])

  // Escape closes the builder and hands focus back to the add control, as
  // shadcn/ui's popover (Base UI) does; the bar's root listens, so it holds
  // wherever focus is inside the builder.
  const addRef = useRef<HTMLButtonElement>(null)
  const closeOnEscape = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Escape' || !open) return
      event.preventDefault()
      setOpen(false)
      addRef.current?.focus()
    },
    [open]
  )

  return { conditions, open, expression, removeAt, addCondition, toggleOpen, addRef, closeOnEscape }
}
