/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState } from 'react'
import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import { gateTexts, useResolvedMatchValue } from '../../runtime/confirm-gate-texts'
import type { ActionControlLabels } from './row-action-types'
import type { TableRecord } from '../../runtime/types'
import type { ActionColumnItem } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/** The words the dialog shows, for either form of `confirm`. */
export interface GateCopy {
  readonly title: string
  readonly message?: string
  readonly confirmLabel: string
  readonly cancelLabel: string
}

export function copyOf(
  action: ActionColumnItem,
  record: TableRecord,
  labels: ActionControlLabels
): GateCopy {
  const { confirm } = action
  if (confirm !== undefined && typeof confirm !== 'string') {
    const texts = gateTexts(confirm, record, action.label, labels.cancel)
    return {
      title: texts.title,
      ...(texts.message !== texts.title && { message: texts.message }),
      confirmLabel: texts.confirmLabel,
      cancelLabel: texts.cancelLabel,
    }
  }
  return {
    title: substituteRecordVars(confirm ?? '', record),
    confirmLabel: action.label,
    cancelLabel: labels.cancel,
  }
}

/** Whether a type-to-confirm gate still waits for the expected text. */
export function useTypedLock(action: ActionColumnItem, record: TableRecord) {
  const object = typeof action.confirm === 'object' ? action.confirm : undefined
  const rawMatch = object?.input?.matchValue
  const matchValue = useResolvedMatchValue(rawMatch, record)
  const [typed, setTyped] = useState('')
  const locked = rawMatch !== undefined && (matchValue === undefined || typed !== matchValue)
  return { object, typed, setTyped, locked }
}
