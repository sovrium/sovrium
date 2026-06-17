/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Select } from '@base-ui/react/select'
import { useMemo, type ReactElement } from 'react'
import { cn } from '@/presentation/islands/lib/cn'
import {
  computeSelectIconClasses,
  computeSelectLabelClasses,
  computeSelectListClasses,
  computeSelectTriggerClasses,
} from './select-default-classes'
import { ChevronDown } from './select-icons'
import { SelectOption } from './select-option-renderers'
import type { SelectIslandProps } from './select-island-types'

export function PlainSelect({
  options,
  placeholder,
  defaultValue,
  disabled,
  label,
  className,
}: SelectIslandProps): ReactElement {
  const items = useMemo(() => options ?? [], [options])
  const valueLabelMap = useMemo(() => new Map(items.map((o) => [o.value, o.label])), [items])
  const renderValue = useMemo(
    () =>
      (value: string | null): string => {
        if (value === null || value === undefined) return placeholder ?? 'Select...'
        return valueLabelMap.get(value) ?? value
      },
    [valueLabelMap, placeholder]
  )

  return (
    <div className={cn(className)}>
      <Select.Root
        items={items}
        defaultValue={defaultValue}
        disabled={disabled}
      >
        {label && <Select.Label className={computeSelectLabelClasses()}>{label}</Select.Label>}

        <Select.Trigger className={computeSelectTriggerClasses()}>
          <Select.Value placeholder={placeholder ?? 'Select...'}>{renderValue}</Select.Value>
          <Select.Icon className={computeSelectIconClasses()}>
            <ChevronDown />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Positioner sideOffset={4}>
            {}
            <Select.Popup>
              <Select.List className={computeSelectListClasses()}>
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
      </Select.Root>
    </div>
  )
}
