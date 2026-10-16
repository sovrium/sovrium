/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Toggle } from '@base-ui/react/toggle'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import { useMemo } from 'react'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import {
  computeToggleGroupClasses,
  computeToggleGroupItemClasses,
} from '@/presentation/islands/form-controls/toggle-default-classes'
import { useLazySharedFilterPublisher } from '@/presentation/islands/hooks/use-lazy-shared-filter-publisher'
import type { SharedFilterPublisherConfig } from '@/presentation/islands/hooks/use-shared-filter-publisher'
import type { CSSProperties, ReactElement } from 'react'

interface ToggleItem {
  readonly id: string
  readonly label: string
  readonly disabled?: boolean
}

interface ToggleGroupIslandProps {
  readonly items?: readonly ToggleItem[]
  readonly toggleType?: 'single' | 'multiple'
  readonly orientation?: 'horizontal' | 'vertical'
  readonly size?: 'sm' | 'default' | 'lg'
  readonly variant?: 'default' | 'outline'
  readonly spacing?: number
  /** The group's accessible name, such as "Alignment". */
  readonly label?: string
  readonly defaultValue?: readonly string[]
  readonly disabled?: boolean
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
  /** The channel the control publishes its value on, as a condition or a param. */
  readonly publishes?: SharedFilterPublisherConfig
}

/**
 * Toggle group island — Base UI `ToggleGroup`, drawn on shadcn/ui's
 * `ToggleGroup` anatomy: `data-slot="toggle-group"` carrying its variant, size,
 * spacing and orientation as data attributes, `data-slot="toggle-group-item"`
 * on each item. `toggleType` picks single or multiple selection; the
 * orientation is also Base UI's arrow-key axis.
 */
export default function ToggleGroupIsland({
  items = [],
  toggleType = 'single',
  orientation = 'horizontal',
  size = 'default',
  variant = 'default',
  spacing = 2,
  label,
  defaultValue,
  disabled = false,
  className,
  id,
  'data-testid': testId,
  publishes,
}: ToggleGroupIslandProps): ReactElement {
  const publish = useLazySharedFilterPublisher(publishes)
  const multiple = toggleType === 'multiple'
  const memoizedDefaultValue = useMemo(
    () => (defaultValue ? [...defaultValue] : []),
    [defaultValue]
  )
  const itemClasses = computeToggleGroupItemClasses({ variant, size })

  return (
    <ToggleGroup
      defaultValue={memoizedDefaultValue}
      multiple={multiple}
      // A single group publishes its pressed item, or nothing once released; a
      // multiple one every pressed item, which an `in` condition reads as any.
      onValueChange={(values) => publish(multiple ? values : (values[0] ?? ''))}
      disabled={disabled}
      orientation={orientation}
      className={resolveClasses(computeToggleGroupClasses(), className)}
      style={{ '--gap': spacing } as CSSProperties}
      id={id}
      data-testid={testId}
      data-slot="toggle-group"
      aria-label={label}
      data-variant={variant}
      data-size={size}
      data-spacing={spacing}
      data-orientation={orientation}
    >
      {items.map((item) => (
        <Toggle
          key={item.id}
          value={item.id}
          disabled={item.disabled}
          className={itemClasses}
          data-slot="toggle-group-item"
          data-variant={variant}
          data-size={size}
          data-spacing={spacing}
        >
          {item.label}
        </Toggle>
      ))}
    </ToggleGroup>
  )
}
