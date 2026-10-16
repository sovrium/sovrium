/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useContext } from 'react'
import { RecordButton, type RecordButtonProps } from '../runtime/record-button'
import { GridStringsContext } from './island/grid-strings'

/**
 * A button field's cell: the shared record button, reading its in-flight word
 * ("Running…") and the outcome of its run in the page language from the grid's
 * interpreter strings.
 */
export function GridRecordButton(props: RecordButtonProps) {
  return (
    <RecordButton
      {...props}
      strings={useContext(GridStringsContext)}
    />
  )
}
