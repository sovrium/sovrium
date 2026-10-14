/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { RecordButton, type RecordButtonProps } from '../runtime/record-button'
import { useGridString } from './island/grid-strings'

/**
 * A button field's cell: the shared record button, reading its in-flight word
 * ("Running…") in the page language from the grid's interpreter strings.
 */
export function GridRecordButton(props: RecordButtonProps) {
  const pendingLabel = useGridString('action.running', 'Running…')
  return (
    <RecordButton
      {...props}
      pendingLabel={pendingLabel}
    />
  )
}
