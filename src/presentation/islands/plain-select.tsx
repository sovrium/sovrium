/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Select } from '@base-ui/react/select'
import { useMemo, type ReactElement } from 'react'
import { cn } from '@/presentation/islands/lib/cn'
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
        {label && (
          <Select.Label className="text-foreground mb-1 block text-sm font-medium">
            {label}
          </Select.Label>
        )}

        <Select.Trigger className="border-border bg-background-raised text-foreground data-[open]:border-primary data-[open]:ring-focus-ring flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm shadow-sm transition-colors data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[open]:ring-1">
          <Select.Value placeholder={placeholder ?? 'Select...'}>{renderValue}</Select.Value>
          <Select.Icon className="text-foreground-subtle ml-2">
            <ChevronDown />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Positioner sideOffset={4}>
            <Select.Popup className="border-border bg-background-overlay max-h-60 overflow-auto rounded-md border py-1 shadow-lg">
              <Select.List>
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
