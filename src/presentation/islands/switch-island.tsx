/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Switch } from '@base-ui/react/switch'
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
      className={`inline-flex items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${className ?? ''}`}
      id={id}
      data-testid={testId}
    >
      <Switch.Root
        defaultChecked={checked}
        disabled={disabled}
        name={name}
        className={`relative inline-flex shrink-0 items-center rounded-full border-2 border-transparent bg-gray-200 transition-colors duration-200 data-[checked]:bg-blue-600 ${sizeClass.track}`}
      >
        <Switch.Thumb
          className={`pointer-events-none block rounded-full bg-white shadow-sm transition-transform duration-200 ${sizeClass.thumb}`}
        />
      </Switch.Root>
      {label && <span className="text-sm text-gray-900">{label}</span>}
    </label>
  )
}
