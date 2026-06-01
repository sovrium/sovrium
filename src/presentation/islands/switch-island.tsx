/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Switch } from '@base-ui/react/switch'
import { cn } from '@/presentation/islands/lib/cn'
import {
  computeSwitchThumbClasses,
  computeSwitchTrackClasses,
} from '@/presentation/islands/toggle-default-classes'
import type { ReactElement } from 'react'

interface SwitchIslandProps {
  readonly checked?: boolean
  readonly disabled?: boolean
  readonly size?: 'sm' | 'md' | 'lg'
  readonly label?: string
  readonly name?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

export default function SwitchIsland({
  checked,
  disabled = false,
  size = 'md',
  label,
  name,
  className,
  id,
  'data-testid': testId,
}: SwitchIslandProps): ReactElement {
  return (
    <label
      className={cn(
        'inline-flex items-center gap-2',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className
      )}
      id={id}
      data-testid={testId}
    >
      <Switch.Root
        defaultChecked={checked}
        disabled={disabled}
        name={name}
        className={computeSwitchTrackClasses({ size })}
      >
        <Switch.Thumb className={computeSwitchThumbClasses({ size })} />
      </Switch.Root>
      {label && <span className="text-foreground text-sm">{label}</span>}
    </label>
  )
}
