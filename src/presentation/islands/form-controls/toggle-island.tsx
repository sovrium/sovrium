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

/**
 * Toggle island — wraps Base UI Toggle for pressable on/off buttons.
 *
 * Renders a button with a pressed/unpressed visual state. Default styling
 * lives in `toggle-default-classes.ts` (prestyled-by-default);
 * author `className` composes AFTER and wins on conflict via Tailwind v4
 * source-order precedence.
 */
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
