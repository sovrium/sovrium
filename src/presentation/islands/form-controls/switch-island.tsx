/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Switch } from '@base-ui/react/switch'
import { cn } from '@/presentation/design/class-merge'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import {
  computeSwitchThumbClasses,
  computeSwitchTrackClasses,
} from '@/presentation/islands/form-controls/toggle-default-classes'
import type { ReactElement } from 'react'

interface SwitchIslandProps {
  readonly checked?: boolean
  readonly disabled?: boolean
  readonly size?: 'sm' | 'default' | 'lg'
  readonly label?: string
  readonly name?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
  /** The id of an element naming the switch, such as a field's title. */
  readonly ariaLabelledBy?: string
}

/** shadcn/ui `Label`, beside the switch. */
const SWITCH_LABEL = 'inline-flex items-center gap-2 text-sm leading-none font-medium select-none'

/**
 * Switch island — Base UI `Switch`, drawn on shadcn/ui's `Switch` anatomy:
 * `data-slot="switch"` with its `data-size` on the root, `data-slot="switch-thumb"`
 * on the thumb. Keyboard support (Space to toggle) and the ARIA switch role are
 * Base UI's. Track and thumb recipes live in `toggle-default-classes.ts`.
 */
export default function SwitchIsland({
  checked,
  disabled = false,
  size = 'default',
  label,
  name,
  className,
  id,
  'data-testid': testId,
  ariaLabelledBy,
}: SwitchIslandProps): ReactElement {
  return (
    <label
      className={resolveClasses(
        cn(SWITCH_LABEL, disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'),
        className
      )}
      id={id}
      data-testid={testId}
      data-slot="label"
    >
      <Switch.Root
        aria-labelledby={ariaLabelledBy}
        defaultChecked={checked}
        disabled={disabled}
        name={name}
        className={computeSwitchTrackClasses()}
        data-slot="switch"
        data-size={size}
      >
        <Switch.Thumb
          className={computeSwitchThumbClasses()}
          data-slot="switch-thumb"
        />
      </Switch.Root>
      {label && <span>{label}</span>}
    </label>
  )
}
