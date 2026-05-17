/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Toggle } from '@base-ui/react/toggle'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import { useMemo } from 'react'
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

/**
 * Toggle group island — wraps Base UI ToggleGroup for grouped toggles.
 *
 * Supports single (one active at a time) or multiple selection modes
 * with roving tabindex keyboard navigation.
 */
export default function ToggleGroupIsland({
  items = [],
  toggleType = 'single',
  defaultValue,
  disabled = false,
  className,
  id,
  'data-testid': testId,
}: ToggleGroupIslandProps): ReactElement {
  // eslint-disable-next-line no-restricted-syntax -- needed to satisfy react-perf/jsx-no-new-array-as-prop; React Compiler not yet enabled in Bun (see docs/infrastructure/ui/react.md)
  const memoizedDefaultValue = useMemo(
    () => (defaultValue ? [...defaultValue] : []),
    [defaultValue]
  )
  return (
    <ToggleGroup
      defaultValue={memoizedDefaultValue}
      multiple={toggleType === 'multiple'}
      disabled={disabled}
      className={`inline-flex rounded-md border border-gray-200 ${className ?? ''}`}
      id={id}
      data-testid={testId}
    >
      {items.map((item) => (
        <Toggle
          key={item.id}
          value={item.id}
          disabled={item.disabled}
          className="border-r border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors last:border-r-0 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[pressed]:bg-gray-100 data-[pressed]:text-gray-900"
        >
          {item.label}
        </Toggle>
      ))}
    </ToggleGroup>
  )
}
