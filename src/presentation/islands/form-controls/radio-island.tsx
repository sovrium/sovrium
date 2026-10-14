/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui radio-group (https://ui.shadcn.com), registry commit 30a58d4498f270af1c1e981a7d78a15cf5740841.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import { cn } from '@/presentation/design/class-merge'
import type { ReactElement } from 'react'

interface OptionItem {
  readonly label: string
  readonly value: string
  readonly disabled?: boolean
}

interface RadioIslandProps {
  readonly options?: readonly OptionItem[]
  readonly defaultValue?: string
  readonly orientation?: 'horizontal' | 'vertical'
  readonly disabled?: boolean
  readonly name?: string
  readonly label?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

/** shadcn/ui `RadioGroup`; the orientation picks the axis the items flow on. */
const GROUP_LAYOUT = {
  vertical: 'grid w-full gap-2',
  horizontal: 'flex w-full flex-row flex-wrap gap-4',
} as const

/**
 * shadcn/ui `RadioGroupItem`, base-nova, with the checkbox's one addition: an
 * unchecked ring in the muted foreground, which holds 3:1 against the page.
 */
const ITEM_ROOT =
  'group/radio-group-item peer relative flex aspect-square size-4 shrink-0 rounded-full border border-input outline-none group-has-[:focus-visible]/field-label:ring-0 group-has-[:focus-visible]/field-label:not-data-checked:border-input after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground group-has-[:focus-visible]/field-label:data-checked:border-primary dark:data-checked:bg-primary data-unchecked:border-muted-foreground'

/** shadcn/ui `RadioGroupItem` indicator and its dot. */
const ITEM_INDICATOR = 'flex size-4 items-center justify-center'
const ITEM_DOT =
  'absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-foreground'

/** shadcn/ui `FieldLegend` (label variant) and the item's `Label`. */
const LEGEND = 'mb-1.5 text-sm font-medium'
const ITEM_LABEL = 'inline-flex items-center gap-2 text-sm leading-none font-normal select-none'

/** One option: shadcn/ui's `RadioGroupItem` beside its `Label`. */
function RadioItem({
  option,
  groupDisabled,
}: {
  readonly option: OptionItem
  readonly groupDisabled: boolean
}): ReactElement {
  return (
    <label
      className={cn(
        ITEM_LABEL,
        option.disabled || groupDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      )}
    >
      <Radio.Root
        value={option.value}
        disabled={option.disabled}
        className={ITEM_ROOT}
        data-slot="radio-group-item"
      >
        <Radio.Indicator
          className={ITEM_INDICATOR}
          data-slot="radio-group-indicator"
        >
          <span className={ITEM_DOT} />
        </Radio.Indicator>
      </Radio.Root>
      <span>{option.label}</span>
    </label>
  )
}

/**
 * Radio group island — Base UI `RadioGroup` + `Radio`, drawn on shadcn/ui's
 * `RadioGroup` anatomy: `data-slot="radio-group"`, `radio-group-item` and
 * `radio-group-indicator`. A checked item fills with the primary colour and
 * carries a dot in the primary foreground.
 *
 * Supports horizontal/vertical layout, keyboard navigation (arrow keys),
 * and roving tabindex for accessibility.
 */
export default function RadioIsland({
  options = [],
  defaultValue,
  orientation = 'vertical',
  disabled = false,
  name,
  label,
  className,
  id,
  'data-testid': testId,
}: RadioIslandProps): ReactElement {
  return (
    <fieldset
      className={cn(className)}
      id={id}
      data-testid={testId}
    >
      {label && (
        <legend
          className={LEGEND}
          data-slot="field-legend"
          data-variant="label"
        >
          {label}
        </legend>
      )}
      <RadioGroup
        defaultValue={defaultValue}
        disabled={disabled}
        name={name}
        className={GROUP_LAYOUT[orientation]}
        data-slot="radio-group"
      >
        {options.map((option) => (
          <RadioItem
            key={option.value}
            option={option}
            groupDisabled={disabled}
          />
        ))}
      </RadioGroup>
    </fieldset>
  )
}
