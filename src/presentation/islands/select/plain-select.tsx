/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Select } from '@base-ui/react/select'
import { useMemo, type ReactElement } from 'react'
import { cn } from '@/presentation/design/class-merge'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import {
  computeSelectIconClasses,
  computeSelectLabelClasses,
  computeSelectListClasses,
  computeSelectTriggerClasses,
} from '../../design/select-default-classes'
import { useSharedFilterPublisher } from '../hooks/use-shared-filter-publisher'
import { ChevronDown } from './select-icons'
import { SelectOption } from './select-option-renderers'
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
 * Base UI assigns `role="listbox"` to `Select.List` when present and demotes
 * `Select.Popup` to `role="presentation"`. The styled overlay surface therefore
 * lives on `Select.List` so the element carrying the listbox role is the real,
 * non-transparent themed paint. The Popup is the bare positioning wrapper.
 */
function SelectPopup({
  options,
  listClassName,
}: {
  readonly options: readonly OptionItem[] | undefined
  readonly listClassName: string
}): ReactElement {
  return (
    <Select.Portal>
      {/*
       * `alignItemWithTrigger` defaults to TRUE, which deliberately draws the
       * popup OVER the trigger so the selected option's text lands on the
       * value text — and takes the field the reader was setting off the
       * screen. A dropdown belongs below the field it fills, pinned to its
       * left edge, which is also what lets `--anchor-width` read as a width
       * the reader can relate to the control.
       *
       * `positionMethod` defaults to `absolute`, which places the popup in the
       * document's own flow: a list opening below the fold then GROWS the
       * document, and a page whose shell is its own scroll container gets a
       * second scrollbar it never had. Anchored to the viewport instead, the
       * popup takes up no document space at all.
       */}
      <Select.Positioner
        sideOffset={4}
        alignItemWithTrigger={false}
        positionMethod="fixed"
        side="bottom"
        align="start"
      >
        <Select.Popup>
          <Select.List className={listClassName}>
            {options?.map((option) => (
              <SelectOption
                key={option.value}
                option={option}
              />
            ))}
          </Select.List>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  )
}

export function PlainSelect({
  options,
  placeholder,
  multiple,
  defaultValue,
  disabled,
  label,
  className,
  publishes,
  designClasses,
  designFloor,
  designReplace,
}: SelectIslandProps): ReactElement {
  // A shared-filter PUBLISHER when `publishes` is declared, and a no-op
  // otherwise — so a plain select costs one closure and dispatches nothing.
  const publish = useSharedFilterPublisher(publishes)
  const items = useMemo(() => options ?? [], [options])
  const renderValue = useValueRenderer(items, placeholder)
  const parts = partClasses(designClasses, designFloor, designReplace)

  return (
    <div className={cn(className)}>
      {/*
       * `modal` defaults to TRUE, which is a dialog's contract: it locks the
       * document's scroll and disables pointer interaction everywhere else.
       * A dropdown is not a dialog — a reader picking a value keeps the page
       * around it. (The searchable half runs on `Combobox.Root`, whose own
       * `modal` already defaults to false, so it needs nothing here.)
       */}
      <Select.Root
        items={items}
        multiple={multiple}
        modal={false}
        defaultValue={defaultValue}
        disabled={disabled}
        onValueChange={publish}
      >
        {label && <Select.Label className={parts.label}>{label}</Select.Label>}

        <Select.Trigger className={parts.trigger}>
          <Select.Value placeholder={placeholder ?? 'Select...'}>{renderValue}</Select.Value>
          <Select.Icon className={parts.icon}>
            <ChevronDown />
          </Select.Icon>
        </Select.Trigger>

        <SelectPopup
          options={options}
          listClassName={parts.list}
        />
      </Select.Root>
    </div>
  )
}
