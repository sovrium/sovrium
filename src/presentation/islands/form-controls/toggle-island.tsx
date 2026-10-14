/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Toggle } from '@base-ui/react/toggle'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { computeToggleClasses } from '@/presentation/islands/form-controls/toggle-default-classes'
import type { ReactElement } from 'react'

interface ToggleIslandProps {
  readonly pressed?: boolean
  readonly disabled?: boolean
  readonly variant?: 'default' | 'outline'
  readonly size?: 'sm' | 'default' | 'lg'
  readonly label?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

/**
 * Toggle island — Base UI `Toggle`, drawn on shadcn/ui's `Toggle` anatomy
 * (`data-slot="toggle"`, `toggleVariants`). The pressed state is Base UI's
 * `aria-pressed`. Author `className` is merged over the recipe through
 * `resolveClasses`, so a conflicting utility replaces the default.
 */
export default function ToggleIsland({
  pressed = false,
  disabled = false,
  variant = 'default',
  size = 'default',
  label,
  className,
  id,
  'data-testid': testId,
}: ToggleIslandProps): ReactElement {
  return (
    <Toggle
      defaultPressed={pressed}
      disabled={disabled}
      className={resolveClasses(computeToggleClasses({ variant, size }), className)}
      id={id}
      data-testid={testId}
      data-slot="toggle"
      data-variant={variant}
      aria-label={label}
    >
      {label}
    </Toggle>
  )
}
