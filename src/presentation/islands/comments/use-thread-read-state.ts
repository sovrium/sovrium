/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMutation } from '@tanstack/react-query'
import { useEffect } from 'react'

/**
 * Mark a read-tracked thread read once it has drawn comments its reader had
 * not read. The list answers `unreadCount` only on a table that tracks reads
 * (`comments.readTracking`), so an untracked thread never posts.
 *
 * The mark is a mutation on the page client, fired once per answer that still
 * counts unread comments. It refreshes no query: the thread already shows what
 * it read, and a failed mark leaves the comments unread, which the next
 * opening retries.
 */
export function useMarkThreadRead(input: {
  readonly tableName: string
  readonly recordId: string
  readonly unreadCount: number | undefined
}): void {
  const { tableName, recordId, unreadCount } = input
  const { mutate } = useMutation({
    mutationFn: () =>
      fetch(`/api/tables/${tableName}/records/${recordId}/comments/read`, {
        method: 'POST',
        credentials: 'include',
      }),
  })
  useEffect(() => {
    if (unreadCount === undefined || unreadCount === 0) return
    mutate()
  }, [tableName, recordId, unreadCount, mutate])
}
