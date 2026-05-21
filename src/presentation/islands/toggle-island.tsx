/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Toggle } from '@base-ui/react/toggle'
import { cn } from '@/presentation/islands/lib/cn'
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

const SIZE_CLASSES = {
  sm: 'h-8 px-2 text-xs',
  md: 'h-9 px-3 text-sm',
  lg: 'h-10 px-4 text-base',
} as const

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
  const variantClass =
    variant === 'outline'
      ? 'border border-border bg-bg-raised text-fg data-[pressed]:bg-primary-subtle data-[pressed]:border-border-strong'
      : 'bg-bg-subtle text-fg data-[pressed]:bg-primary-subtle'

  return (
    <Toggle
      defaultPressed={pressed}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        variantClass,
        SIZE_CLASSES[size],
        className
      )}
      id={id}
      data-testid={testId}
      aria-label={label}
    >
      {label}
    </Toggle>
  )
}
