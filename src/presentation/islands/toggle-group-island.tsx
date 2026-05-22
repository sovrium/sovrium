/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Toggle } from '@base-ui/react/toggle'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import { useMemo } from 'react'
import { cn } from '@/presentation/islands/lib/cn'
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
  return (
    <ToggleGroup
      defaultValue={memoizedDefaultValue}
      multiple={toggleType === 'multiple'}
      disabled={disabled}
      className={cn('border-border inline-flex rounded-md border', className)}
      id={id}
      data-testid={testId}
    >
      {items.map((item) => (
        <Toggle
          key={item.id}
          value={item.id}
          disabled={item.disabled}
          className="border-border text-foreground-muted data-[pressed]:bg-primary-subtle data-[pressed]:text-foreground border-r px-3 py-2 text-sm font-medium transition-colors last:border-r-0 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
        >
          {item.label}
        </Toggle>
      ))}
    </ToggleGroup>
  )
}
