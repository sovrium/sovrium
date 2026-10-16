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
import { useLazySharedFilterPublisher } from '@/presentation/islands/hooks/use-lazy-shared-filter-publisher'
import type { SharedFilterPublisherConfig } from '@/presentation/islands/hooks/use-shared-filter-publisher'
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
  /** The author's `aria-label`, naming a switch that carries no visible label. */
  readonly ariaLabel?: string
  /** The channel the control publishes its value on, as a condition or a param. */
  readonly publishes?: SharedFilterPublisherConfig
}

/** shadcn/ui `Label`, beside the switch. */
const SWITCH_LABEL = 'inline-flex items-center gap-2 text-sm leading-none font-medium select-none'

/**
 * Switch island — Base UI `Switch`, drawn on shadcn/ui's `Switch` anatomy:
 * `data-slot="switch"` with its `data-size` on the root, `data-slot="switch-thumb"`
 * on the thumb. Keyboard support (Space to toggle) and the ARIA switch role are
 * Base UI's. Track and thumb recipes live in `toggle-default-classes.ts`.
 *
 * The author's `id` goes to `Switch.Root`, which hands it to the control Base UI
 * treats as labelable, so a page `label` whose `for` names that id names the
 * switch and toggles it. The wrapper is a `<label>` only when it has a caption:
 * an empty wrapping label would be found first and name the switch with nothing.
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
  ariaLabel,
  publishes,
}: SwitchIslandProps): ReactElement {
  const publish = useLazySharedFilterPublisher(publishes)
  const Wrapper = label ? 'label' : 'span'
  return (
    <Wrapper
      className={resolveClasses(
        cn(SWITCH_LABEL, disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'),
        className
      )}
      data-testid={testId}
      data-slot={label ? 'label' : undefined}
    >
      <Switch.Root
        id={id}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        defaultChecked={checked}
        onCheckedChange={(on) => publish(on)}
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
    </Wrapper>
  )
}
