/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  FILTER_BAR_ADD_CLASSES,
  FILTER_BAR_ANCHOR_CLASSES,
  FILTER_BAR_POPOVER_PLACEMENT_CLASSES,
  FILTER_BAR_ROW_CLASSES,
} from '@/presentation/design/filter-bar-default-classes'
import { computePopoverContentClasses } from '../overlays/popover-default-classes'
import { ConditionBuilder } from './condition-builder'
import { FilterChip } from './filter-chip'
import { useFilterBarState } from './use-filter-bar-state'
import type { FilterBarCondition, FilterBarField } from '@/presentation/design/filter-expression'
import type { ReactElement, RefObject } from 'react'
/** The bar's own words in the page language, keyed `filterBar.*`; absent on an English page. */
type Strings = Readonly<Record<string, string>> | undefined

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
  /** Mirror the conditions in the page address (`publishes.url`). */
  readonly url?: boolean
  /** The bar's own words (`filterBar.*`), server-resolved, where they differ from English. */
  readonly uiStrings?: Readonly<Record<string, string>>
}

/** lucide's `circle-plus`, the add control's glyph. */
const ADD_GLYPH = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
    />
    <path d="M8 12h8" />
    <path d="M12 8v8" />
  </svg>
)

const POPOVER_CLASSES = `${computePopoverContentClasses()} ${FILTER_BAR_POPOVER_PLACEMENT_CLASSES}`

/**
 * The add control and the condition builder it opens, on the popover surface
 * under it. The popover is drawn in the bar rather than portalled, so the
 * builder stays inside the bar's own markup.
 */
function AddFilter({
  label,
  strings,
  fields,
  open,
  addRef,
  onToggle,
  onApply,
}: {
  readonly label: string
  readonly strings: Strings
  readonly fields: readonly FilterBarField[]
  readonly open: boolean
  readonly addRef: RefObject<HTMLButtonElement | null>
  readonly onToggle: () => void
  readonly onApply: (condition: FilterBarCondition) => void
}): ReactElement {
  return (
    <span className={FILTER_BAR_ANCHOR_CLASSES}>
      <button
        ref={addRef}
        type="button"
        onClick={onToggle}
        aria-haspopup="dialog"
        aria-expanded={open ? 'true' : 'false'}
        data-slot="button"
        data-variant="outline"
        data-size="sm"
        data-icon="inline-start"
        className={FILTER_BAR_ADD_CLASSES}
      >
        {ADD_GLYPH}
        {label}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          data-slot="popover-content"
          data-open=""
          className={POPOVER_CLASSES}
        >
          <ConditionBuilder
            fields={fields}
            strings={strings}
            onApply={onApply}
          />
        </div>
      )}
    </span>
  )
}

/**
 * The applied conditions, then the add control.
 *
 * The conditions wrap rather than scroll: a filter a reader cannot see is one
 * they cannot lift, and a horizontal scroller hides exactly the oldest
 * condition — the one most likely to have been forgotten.
 */
function ChipRow({
  addLabel,
  removeLabel,
  strings,
  conditions,
  fields,
  allowAdd,
  open,
  addRef,
  onRemove,
  onToggle,
  onApply,
}: {
  /** The add control's name, and a chip's remove name with `{field}` still to fill. */
  readonly addLabel: string
  readonly removeLabel: string
  readonly strings: Strings
  readonly conditions: readonly FilterBarCondition[]
  readonly fields: readonly FilterBarField[]
  readonly allowAdd: boolean
  readonly open: boolean
  readonly addRef: RefObject<HTMLButtonElement | null>
  readonly onRemove: (index: number) => void
  readonly onToggle: () => void
  readonly onApply: (condition: FilterBarCondition) => void
}): ReactElement {
  return (
    <div className={FILTER_BAR_ROW_CLASSES}>
      {conditions.map((condition, index) => (
        <FilterChip
          key={`${condition.field}-${condition.operator}-${condition.value}-${index}`}
          index={index}
          condition={condition}
          field={fields.find((candidate) => candidate.name === condition.field)}
          removeLabel={removeLabel}
          strings={strings}
          onRemove={onRemove}
        />
      ))}
      {allowAdd && (
        <AddFilter
          label={addLabel}
          strings={strings}
          fields={fields}
          open={open}
          addRef={addRef}
          onToggle={onToggle}
          onApply={onApply}
        />
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
  url = false,
  uiStrings,
}: FilterBarIslandProps): ReactElement {
  const state = useFilterBarState({ bindTo, url, fields, combinator, initialConditions })

  return (
    <div
      className={className}
      onKeyDown={state.closeOnEscape}
    >
      <ChipRow
        addLabel={uiStrings?.['filterBar.addFilter'] ?? 'Add filter'}
        removeLabel={uiStrings?.['filterBar.removeFilter'] ?? 'Remove {field} filter'}
        strings={uiStrings}
        conditions={state.conditions}
        fields={fields}
        allowAdd={allowAdd}
        open={state.open}
        addRef={state.addRef}
        onRemove={state.removeAt}
        onToggle={state.toggleOpen}
        onApply={state.addCondition}
      />
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
