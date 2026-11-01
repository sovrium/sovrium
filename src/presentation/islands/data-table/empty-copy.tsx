/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useGridString } from './island/grid-strings'
import type { ReactNode } from 'react'

/**
 * An empty grid's words: the empty message, and under it the author's guidance
 * line (`emptyDescription`) when one was declared. `guided` is false while a
 * search or a filter narrowed the read, which proves nothing about the data, so
 * the guidance about an empty collection stays out.
 */
export function EmptyCopy({
  message,
  guided,
}: {
  readonly message: string
  readonly guided: boolean
}): ReactNode {
  const guidance = useGridString('datatable.emptyDescription', '')
  if (!guided || guidance === '' || message === '') return message
  return (
    <>
      <p>{message}</p>
      <p
        className="text-muted-foreground mt-1"
        data-slot="empty-description"
      >
        {guidance}
      </p>
    </>
  )
}
