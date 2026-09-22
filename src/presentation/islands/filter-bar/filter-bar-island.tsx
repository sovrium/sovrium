/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { buildFilterExpression } from '@/presentation/design/filter-expression'
import { useSharedFilterPublisher } from '../hooks/use-shared-filter-publisher'
import { ConditionBuilder } from './condition-builder'
import { FilterChip } from './filter-chip'
import type { FilterBarCondition, FilterBarField } from '@/presentation/design/filter-expression'
import type { ReactElement } from 'react'

/**
 * `filter-bar` — one filter, many views.
 *
 * The island holds a CONDITION SET and publishes it; it never reads rows. Every
 * data-bound component that already merges a shared param bag
 * (`dataSource.bindTo` + `sharedFilter`) subscribes to it with no change of its
 * own, which is what lets one bar narrow a grid, a second grid over a DIFFERENT
 * table, and — as the view islands adopt the hook — a KPI and a chart beside
 * them.
 *
 * ─── ONE PARAM, `filter`, AND WHY IT IS NOT ONE PER CONDITION ──────────────
 *
 * The conditions are a TREE — a combinator over leaves — and a flat param bag
 * cannot say which leaves an `or` groups. So the whole expression rides as one
 * JSON string under `filter`, which is the param `parseFilterParameter` already
 * reads and the SQL WHERE builder already walks (`or` groups included).
 *
 * ─── IT PUBLISHES TWICE, ON TWO CHANNELS, FOR ONE REASON ───────────────────
 *
 * The `island:system-query` event is the live path. Beside it the bar keeps its
 * current expression in a hidden input carrying `data-publishes-bind-to` +
 * `data-publishes-param`, and the SSR placeholder renders the same element with
 * the opening conditions.
 *
 * That second channel is not redundancy, it is the fix for a race the event
 * cannot win. This island's chunk is a few KB; the data-table's is several
 * hundred. The bar therefore publishes its initial conditions BEFORE the grid's
 * listener exists, essentially always — and the failure is silent and total: a
 * page whose chip says "Status is Paid" over a grid showing everything.
 * `useSharedFilter` reads the DOM element at mount, so a subscriber that missed
 * the event still opens narrowed. The mechanism is the one that already existed
 * for a native `<select>`, generalised rather than duplicated.
 */
interface FilterBarIslandProps {
  readonly className?: string
  readonly bindTo: string
  readonly fields: readonly FilterBarField[]
  readonly conditions?: readonly FilterBarCondition[]
  readonly combinator?: 'and' | 'or'
  readonly allowAdd?: boolean
}

/**
 * The condition set the bar is holding, the expression it publishes, and the
 * two edits a reader can make to it.
 *
 * The publish runs as an EFFECT on the expression rather than inside each edit
 * handler, so the opening conditions are published on mount by the same path
 * that publishes an edit — one channel with one code path, instead of a mount
 * case that can drift from the edit case.
 */
function useFilterBarState({
  bindTo,
  fields,
  combinator,
  initialConditions,
}: {
  readonly bindTo: string
  readonly fields: readonly FilterBarField[]
  readonly combinator: 'and' | 'or'
  readonly initialConditions: readonly FilterBarCondition[] | undefined
}) {
  const [conditions, setConditions] = useState<readonly FilterBarCondition[]>(
    initialConditions ?? []
  )
  const [open, setOpen] = useState(false)

  const expression = useMemo(
    () => buildFilterExpression(conditions, fields, combinator),
    [conditions, fields, combinator]
  )

  // A fresh object literal per render is deliberate and free: the hook memoizes
  // on `bindTo` / `param` (both primitives), not on the object's identity.
  const publish = useSharedFilterPublisher({ bindTo, param: 'filter' })
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

  return { conditions, open, expression, removeAt, addCondition, toggleOpen }
}

/**
 * The applied conditions, and the handle that opens the add-condition menu.
 *
 * The chips wrap rather than scroll: a filter a reader cannot see is one they
 * cannot lift, and a horizontal scroller hides exactly the oldest condition —
 * the one most likely to have been forgotten.
 */
function ChipRow({
  conditions,
  fields,
  allowAdd,
  open,
  onRemove,
  onToggle,
}: {
  readonly conditions: readonly FilterBarCondition[]
  readonly fields: readonly FilterBarField[]
  readonly allowAdd: boolean
  readonly open: boolean
  readonly onRemove: (index: number) => void
  readonly onToggle: () => void
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {conditions.map((condition, index) => (
        <FilterChip
          key={`${condition.field}-${condition.operator}-${condition.value}-${index}`}
          index={index}
          condition={condition}
          field={fields.find((candidate) => candidate.name === condition.field)}
          onRemove={onRemove}
        />
      ))}
      {allowAdd && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open ? 'true' : 'false'}
          // GHOST, not a dashed outline. A dashed border is the vocabulary of a
          // drop target or an empty slot; this is a control that opens a menu,
          // and the design draws that as the quietest real button it has.
          className={computeButtonDefaultClasses({ variant: 'ghost', size: 'sm' })}
        >
          Add filter
        </button>
      )}
    </div>
  )
}

export default function FilterBarIsland({
  className,
  bindTo,
  fields,
  conditions: initialConditions,
  combinator = 'and',
  allowAdd = true,
}: FilterBarIslandProps): ReactElement {
  const state = useFilterBarState({ bindTo, fields, combinator, initialConditions })

  return (
    <div className={className}>
      <ChipRow
        conditions={state.conditions}
        fields={fields}
        allowAdd={allowAdd}
        open={state.open}
        onRemove={state.removeAt}
        onToggle={state.toggleOpen}
      />
      {state.open && (
        <div className="mt-2">
          <ConditionBuilder
            fields={fields}
            onApply={state.addCondition}
          />
        </div>
      )}
      <input
        type="hidden"
        readOnly
        data-publishes-bind-to={bindTo}
        data-publishes-param="filter"
        value={state.expression}
      />
    </div>
  )
}
