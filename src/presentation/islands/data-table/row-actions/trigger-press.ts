/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState, type MouseEvent } from 'react'
import { requestTriggerFocus } from './trigger-focus'
import type { ActionClickHandler } from './row-action-types'
import type { TableRecord } from '../../runtime/types'
import type { ActionColumnItem } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/**
 * The recipe tone an authored `variant` asks for. An UNNAMED variant returns
 * `undefined`, so the recipe applies its own default and omission and an
 * explicit `secondary` reach the same class string.
 */
export function triggerTone(
  variant: ActionColumnItem['variant']
): 'primary' | 'ghost' | 'destructive' | undefined {
  if (variant === 'default') return 'primary'
  if (variant === 'ghost') return 'ghost'
  if (variant === 'destructive') return 'destructive'
  return undefined
}

/**
 * The press of a trigger: arm its gate or editor, or dispatch the action and
 * hold the button pending until it answers. Only THIS row's button locks.
 */
export function useTriggerPress({
  action,
  record,
  focusKey,
  onArm,
  onActionClick,
}: {
  readonly action: ActionColumnItem
  readonly record: TableRecord
  readonly focusKey: string
  readonly onArm: () => void
  readonly onActionClick?: ActionClickHandler
}) {
  const [pending, setPending] = useState(false)
  const armed = action.editSelect !== undefined || action.confirm !== undefined
  const onClick = onActionClick
    ? (event: MouseEvent<HTMLButtonElement>) => {
        if (armed) return onArm()
        if (pending) return undefined
        setPending(true)
        // The re-read rebuilds this button; its successor takes the focus back.
        requestTriggerFocus(focusKey)
        const origin = event.currentTarget
        void Promise.resolve(onActionClick(action, record, origin)).finally(() => setPending(false))
        return undefined
      }
    : undefined
  return { pending, onClick }
}
