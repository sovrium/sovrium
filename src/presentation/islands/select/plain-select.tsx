/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Select } from '@base-ui/react/select'
import { useCallback, useMemo, useState, type ReactElement } from 'react'
import { cn } from '@/presentation/design/class-merge'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { modalPortalContainer } from '@/presentation/islands/runtime/modal-portal-container'
import {
  computeSelectClearClasses,
  computeSelectIconClasses,
  computeSelectLabelClasses,
  computeSelectListClasses,
  computeSelectPopupClasses,
  computeSelectPositionerClasses,
  computeSelectScrollArrowClasses,
  computeSelectTriggerClasses,
  computeSelectValueClasses,
} from '../../design/select-default-classes'
import {
  usePublishedValueInAddress,
  useSharedFilterPublisher,
} from '../hooks/use-shared-filter-publisher'
import { ChevronDown, ChevronUp, XMark } from './select-icons'
import { SelectOptions } from './select-option-renderers'
import type { OptionItem, SelectIslandProps } from './select-island-types'

/**
 * Non-searchable select rendered with Base UI Select primitives.
 *
 * Passing `items` to Select.Root lets `<Select.Value>` render the selected
 * option's label automatically when only the value is known.
 *
 * Identity props (`id`, `data-testid`) are intentionally NOT applied to this
 * inner wrapper. The SSR island marker rendered by `island-form-components.tsx`
 * already carries them on the outer `<div data-island="select">`, which
 * survives hydration as the React mount root. Re-emitting them here would
 * produce duplicate DOM attributes and break Playwright strict-mode locators.
 */
/**
 * Render the trigger's caption for a selected value.
 *
 * Extracted from the component so `PlainSelect` stays under its line cap: the
 * memo is three statements of pure label lookup with no JSX in it.
 */
function useValueRenderer(
  items: readonly OptionItem[],
  placeholder: string | undefined
): (value: SelectedValue) => string {
  const valueLabelMap = useMemo(() => new Map(items.map((o) => [o.value, o.label])), [items])
  return useMemo(() => {
    const labelOf = (value: string): string => valueLabelMap.get(value) ?? value
    return (value: SelectedValue): string => {
      const fallback = placeholder ?? 'Select...'
      if (typeof value === 'string') return labelOf(value)
      if (value === null || value === undefined) return fallback
      // A MULTIPLE select holds an ARRAY — including the empty one it starts
      // on, which is a selection of nothing and so reads as the placeholder.
      // Every choice is named, comma separated, as the primitive names them.
      return value.length === 0 ? fallback : value.map(labelOf).join(', ')
    }
  }, [valueLabelMap, placeholder])
}

/**
 * What `Select.Value` hands its render function.
 *
 * A single select holds one value or none; a `multiple` one holds an ARRAY,
 * empty until the first pick. Base UI types the callback's argument as `any`
 * — the array only appears under `multiple` — so the union is named here and
 * the renderer below is what decides how a set of choices reads.
 */
type SelectedValue = string | readonly string[] | null

/** The four parts `PlainSelect` renders, resolved from their three layers. */
interface SelectPartClasses {
  readonly label: string
  readonly trigger: string
  readonly icon: string
  readonly list: string
}

/**
 * The class lists for the parts no `className` can reach.
 *
 * `design.components.select.parts.root` arrives already merged into
 * `className` — the server folded it in — so only the parts this island builds
 * itself are resolved here, from the maps the SSR renderer serialised beside it.
 *
 * Three layers per part, in `resolveClasses`' order: the recipe (dropped when
 * the operator asked for `replace`), then the operator's classes, then the
 * FLOOR. The floor is applied last and outside the `replace` branch on purpose
 * — an operator who replaces the recipe is the one most in need of it, because
 * replacing is what removes the trigger's own focus ring.
 *
 * The author layer is left `undefined`: a per-instance `className` addresses
 * the island root, and there is no authoring channel that reaches an inner part
 * of one node.
 */
const partClasses = (
  designClasses: Readonly<Record<string, string>> | undefined,
  designFloor: Readonly<Record<string, string>> | undefined,
  designReplace: boolean | undefined
): SelectPartClasses => {
  const part = (name: string, recipe: () => string): string =>
    resolveClasses(
      designReplace === true ? '' : recipe(),
      designClasses?.[name],
      undefined,
      designFloor?.[name]
    )
  return {
    label: part('label', computeSelectLabelClasses),
    trigger: part('trigger', computeSelectTriggerClasses),
    icon: part('icon', computeSelectIconClasses),
    list: part('list', computeSelectListClasses),
  }
}

/**
 * The floating option list.
 *
 * Extracted from `PlainSelect` so that function stays inside its line cap —
 * the same reason `useValueRenderer` above is its own function.
 *
 * shadcn/ui's `SelectContent` anatomy: the surface is the popup
 * (`data-slot="select-content"`), framing the scroll arrows and the option
 * list. Base UI gives `Select.List` the `listbox` role and the popup
 * `presentation`; the list carries the `list` part an author restyles.
 *
 * Two positioning choices depart from shadcn's defaults, for the reasons the
 * field is built around:
 *
 * - `alignItemWithTrigger` defaults to TRUE, which deliberately draws the
 *   popup OVER the trigger so the selected option's text lands on the value
 *   text — and takes the field the reader was setting off the screen. A
 *   dropdown belongs below the field it fills, pinned to its left edge, which
 *   is also what lets `--anchor-width` read as a width the reader can relate
 *   to the control.
 * - `positionMethod` defaults to `absolute`, which places the popup in the
 *   document's own flow: a list opening below the fold then GROWS the
 *   document, and a page whose shell is its own scroll container gets a second
 *   scrollbar it never had. Anchored to the viewport instead, the popup takes
 *   up no document space at all.
 */
function SelectPopup({
  options,
  listClassName,
}: {
  readonly options: readonly OptionItem[] | undefined
  readonly listClassName: string
}): ReactElement {
  return (
    <Select.Portal container={modalPortalContainer}>
      <Select.Positioner
        className={computeSelectPositionerClasses()}
        sideOffset={4}
        alignItemWithTrigger={false}
        positionMethod="fixed"
        side="bottom"
        align="start"
      >
        <Select.Popup
          className={computeSelectPopupClasses()}
          data-slot="select-content"
          data-align-trigger="false"
        >
          <Select.ScrollUpArrow
            className={computeSelectScrollArrowClasses('top')}
            data-slot="select-scroll-up-button"
          >
            <ChevronUp />
          </Select.ScrollUpArrow>
          <Select.List className={listClassName}>
            <SelectOptions options={options ?? NO_OPTIONS} />
          </Select.List>
          <Select.ScrollDownArrow
            className={computeSelectScrollArrowClasses('bottom')}
            data-slot="select-scroll-down-button"
          >
            <ChevronDown />
          </Select.ScrollDownArrow>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  )
}

const NO_OPTIONS: readonly OptionItem[] = []

/** shadcn/ui `SelectTrigger`: the value, then the chevron Base UI's `Select.Icon` draws. */
function SelectTrigger({
  parts,
  placeholder,
  renderValue,
  controls,
  labelledBy,
  ariaLabel,
}: {
  readonly parts: SelectPartClasses
  readonly placeholder: string | undefined
  readonly renderValue: (value: SelectedValue) => string
  /** The data components this control narrows, when it publishes on a channel. */
  readonly controls: string | undefined
  readonly labelledBy: string | undefined
  readonly ariaLabel: string | undefined
}): ReactElement {
  return (
    <Select.Trigger
      {...(controls === undefined ? {} : { 'aria-controls': controls })}
      className={parts.trigger}
      data-slot="select-trigger"
      data-size="default"
      // Spread, never `undefined`: an explicit prop would replace the
      // `aria-labelledby` Base UI points at the select's own label.
      {...(labelledBy === undefined ? {} : { 'aria-labelledby': labelledBy })}
      {...(ariaLabel === undefined ? {} : { 'aria-label': ariaLabel })}
    >
      <Select.Value
        placeholder={placeholder ?? 'Select...'}
        className={computeSelectValueClasses()}
        data-slot="select-value"
      >
        {renderValue}
      </Select.Value>
      <Select.Icon render={<ChevronDown className={parts.icon} />} />
    </Select.Trigger>
  )
}

/** The clear control, once a clearable select holds a value. */
function ClearControl({
  clear,
  label,
}: {
  readonly clear: ReturnType<typeof useClearableValue>
  readonly label: string | undefined
}): ReactElement | undefined {
  if (clear?.value == null || clear.value === '') return undefined
  return (
    <button
      type="button"
      aria-label={label ?? 'Clear'}
      data-slot="select-clear"
      className={computeSelectClearClasses()}
      onClick={clear.reset}
    >
      <XMark />
    </button>
  )
}

/**
 * A clearable select holds its value itself, so its clear control can return
 * it to nothing; every other select leaves the value to the primitive.
 */
function useClearableValue(
  enabled: boolean,
  defaultValue: string | undefined,
  publish: (value: unknown) => void
):
  | {
      readonly value: string | null
      readonly change: (next: unknown) => void
      readonly reset: () => void
    }
  | undefined {
  const [value, setValue] = useState<string | null>(defaultValue ?? null)
  const change = useCallback(
    (next: unknown) => {
      setValue(typeof next === 'string' ? next : null)
      publish(next)
    },
    [publish]
  )
  const reset = useCallback(() => change(null), [change])
  return useMemo(
    () => (enabled ? { value, change, reset } : undefined),
    [enabled, value, change, reset]
  )
}

/**
 * The value the select opens on: the one its `publishes.url` left in the page
 * address (a multiple select's as a list), else its `defaultValue`.
 */
function useOpeningValue(
  publishes: SelectIslandProps['publishes'],
  defaultValue: string | undefined,
  multiple: boolean | undefined
): string | readonly string[] | undefined {
  const restored = usePublishedValueInAddress(publishes)
  if (typeof restored !== 'string') return defaultValue
  return multiple === true ? restored.split(',') : restored
}

/**
 * The root's value props and the clear control: a shared-filter PUBLISHER
 * when `publishes` is declared, and a no-op otherwise — so a plain select
 * costs one closure and dispatches nothing.
 */
function useSelectValue({
  publishes,
  defaultValue,
  multiple,
  clearable,
}: Pick<SelectIslandProps, 'publishes' | 'defaultValue' | 'multiple' | 'clearable'>) {
  const publish = useSharedFilterPublisher(publishes)
  const opening = useOpeningValue(publishes, defaultValue, multiple)
  const clear = useClearableValue(
    clearable === true && multiple !== true,
    typeof opening === 'string' ? opening : undefined,
    publish
  )
  const rootValue =
    clear === undefined
      ? { defaultValue: opening, onValueChange: publish }
      : { value: clear.value, onValueChange: clear.change }
  return { clear, rootValue }
}

/**
 * The plain select: shadcn/ui's `Select` on Base UI.
 *
 * `modal` defaults to TRUE, which is a dialog's contract: it locks the
 * document's scroll and disables pointer interaction everywhere else. A
 * dropdown is not a dialog — a reader picking a value keeps the page around
 * it. (The searchable half runs on `Combobox.Root`, whose own `modal` already
 * defaults to false, so it needs nothing here.)
 *
 * A shared-filter PUBLISHER when `publishes` is declared, and a no-op
 * otherwise — so a plain select costs one closure and dispatches nothing. A
 * select drawing no label of its own is named by `labelledBy`, its field's label.
 */
export function PlainSelect({
  options,
  placeholder,
  multiple,
  clearable,
  defaultValue,
  disabled,
  label,
  labelledBy,
  ariaLabel,
  className,
  publishes,
  designClasses,
  designFloor,
  designReplace,
  uiStrings,
}: SelectIslandProps): ReactElement {
  const { clear, rootValue } = useSelectValue({ publishes, defaultValue, multiple, clearable })
  const items = useMemo(() => options ?? [], [options])
  const renderValue = useValueRenderer(items, placeholder)
  const parts = partClasses(designClasses, designFloor, designReplace)

  return (
    <div className={cn(className)}>
      <Select.Root
        items={items}
        multiple={multiple}
        modal={false}
        disabled={disabled}
        {...rootValue}
      >
        {label && (
          <Select.Label
            className={parts.label}
            data-slot="label"
          >
            {label}
          </Select.Label>
        )}

        <div className="relative">
          <SelectTrigger
            parts={parts}
            placeholder={placeholder}
            renderValue={renderValue}
            controls={publishes?.controls}
            labelledBy={label ? undefined : labelledBy}
            ariaLabel={label || labelledBy !== undefined ? undefined : ariaLabel}
          />
          <ClearControl {...{ clear, label: uiStrings?.['select.clear'] }} />
        </div>

        <SelectPopup
          options={options}
          listClassName={parts.list}
        />
      </Select.Root>
    </div>
  )
}
