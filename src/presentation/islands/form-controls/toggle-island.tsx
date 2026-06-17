/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Toggle } from '@base-ui/react/toggle'
import { computeToggleClasses } from '@/presentation/islands/form-controls/toggle-default-classes'
import type { ReactElement } from 'react'

interface ToggleIslandProps {
  readonly pressed?: boolean
  readonly disabled?: boolean
  readonly variant?: 'default' | 'outline'
  readonly size?: 'sm' | 'md' | 'lg'
  readonly label?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

export default function ToggleIsland({
  pressed = false,
  disabled = false,
  variant = 'default',
  size = 'md',
  label,
  className,
  id,
  'data-testid': testId,
}: ToggleIslandProps): ReactElement {
  const defaultClasses = computeToggleClasses({ variant, size })

  return (
    <Toggle
      defaultPressed={pressed}
      disabled={disabled}
      className={`${defaultClasses} ${className ?? ''}`}
      id={id}
      data-testid={testId}
      aria-label={label}
    >
      {label}
    </Toggle>
  )
}
