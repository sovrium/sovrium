/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Toggle } from '@base-ui/react/toggle'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import { useMemo } from 'react'
import {
  computeToggleGroupClasses,
  computeToggleGroupItemClasses,
} from '@/presentation/islands/form-controls/toggle-default-classes'
import type { ReactElement } from 'react'

interface ToggleItem {
  readonly id: string
  readonly label: string
  readonly disabled?: boolean
}

interface ToggleGroupIslandProps {
  readonly items?: readonly ToggleItem[]
  readonly toggleType?: 'single' | 'multiple'
  readonly defaultValue?: readonly string[]
  readonly disabled?: boolean
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

export default function ToggleGroupIsland({
  items = [],
  toggleType = 'single',
  defaultValue,
  disabled = false,
  className,
  id,
  'data-testid': testId,
}: ToggleGroupIslandProps): ReactElement {
  const memoizedDefaultValue = useMemo(
    () => (defaultValue ? [...defaultValue] : []),
    [defaultValue]
  )
  const wrapperClasses = computeToggleGroupClasses()
  const itemClasses = computeToggleGroupItemClasses()

  return (
    <ToggleGroup
      defaultValue={memoizedDefaultValue}
      multiple={toggleType === 'multiple'}
      disabled={disabled}
      className={`${wrapperClasses} ${className ?? ''}`}
      id={id}
      data-testid={testId}
    >
      {items.map((item) => (
        <Toggle
          key={item.id}
          value={item.id}
          disabled={item.disabled}
          className={itemClasses}
        >
          {item.label}
        </Toggle>
      ))}
    </ToggleGroup>
  )
}
