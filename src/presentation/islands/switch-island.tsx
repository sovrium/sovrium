/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Switch } from '@base-ui/react/switch'
import { cn } from '@/presentation/islands/lib/cn'
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

const SIZE_CLASSES = {
  sm: { track: 'h-4 w-7', thumb: 'h-3 w-3 data-[checked]:translate-x-3' },
  md: { track: 'h-5 w-9', thumb: 'h-4 w-4 data-[checked]:translate-x-4' },
  lg: { track: 'h-6 w-11', thumb: 'h-5 w-5 data-[checked]:translate-x-5' },
} as const

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
  const sizeClass = SIZE_CLASSES[size]

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
        className={`bg-bg-subtle data-[checked]:bg-primary relative inline-flex shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 ${sizeClass.track}`}
      >
        <Switch.Thumb
          className={`bg-bg-raised pointer-events-none block rounded-full shadow-sm transition-transform duration-200 ${sizeClass.thumb}`}
        />
      </Switch.Root>
      {label && <span className="text-fg text-sm">{label}</span>}
    </label>
  )
}
