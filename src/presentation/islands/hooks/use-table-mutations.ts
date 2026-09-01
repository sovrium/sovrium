/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createRecordsClient } from '@/presentation/api/client'
import { saveRetryDelayMs, shouldRetrySave } from './save-retry-policy'
import type { CreateRecordRequest, UpdateRecordRequest } from '@/domain/models/api/tables/records'

// ---------------------------------------------------------------------------
// API client (singleton, matches use-data-table-query.ts pattern)
// ---------------------------------------------------------------------------

const apiClient = createRecordsClient(typeof window !== 'undefined' ? window.location.origin : '')

// ---------------------------------------------------------------------------
// Shared invalidation helper
// ---------------------------------------------------------------------------

function useInvalidateTableRecords(tableId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['table-records', tableId] })
}

// ---------------------------------------------------------------------------
// Create record mutation
// ---------------------------------------------------------------------------

export function useCreateRecord(tableId: string) {
  const invalidate = useInvalidateTableRecords(tableId)

  return useMutation({
    mutationFn: async (fields: CreateRecordRequest['fields']) => {
      const res = await apiClient.api.tables[':tableId'].records.$post({
        param: { tableId },
        json: { fields },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Failed to create record' }))
        const error = body as { message?: string; code?: string; field?: string }
        // eslint-disable-next-line functional/no-throw-statements -- TanStack Query expects thrown errors
        throw Object.assign(new Error(error.message ?? 'Failed to create record'), {
          code: error.code,
          field: error.field,
        })
      }

      return res.json()
    },
    onSuccess: invalidate,
  })
}

// ---------------------------------------------------------------------------
// Update record mutation
// ---------------------------------------------------------------------------

export interface UpdateRecordOptions {
  /**
   * Re-issue a save that failed for a transient reason (a dropped connection,
   * a 5xx) on a growing delay, up to the bounded budget declared by
   * `MAX_SAVE_RETRIES` in `save-retry-policy.ts`.
   *
   * Opt-in rather than the default because it changes how long a failure takes
   * to surface. Inline editing wants it: the user has moved on and a save lost
   * to a blip is a lost edit. A form the user is still looking at, with an
   * explicit submit button, would rather report the failure promptly.
   */
  readonly retryTransientFailures?: boolean
}

export function useUpdateRecord(tableId: string, options?: UpdateRecordOptions) {
  const invalidate = useInvalidateTableRecords(tableId)

  return useMutation({
    mutationFn: async (params: {
      readonly recordId: string
      readonly fields: UpdateRecordRequest['fields']
      /**
       * The `updated_at` the client last read for this record. When present the
       * server compares it against the stored row and refuses the write with
       * 409 if the record moved on — which is what stops a save made against a
       * stale view from silently destroying someone else's change.
       */
      readonly updatedAt?: string
    }) => {
      const res = await apiClient.api.tables[':tableId'].records[':recordId'].$patch({
        param: { tableId, recordId: params.recordId },
        json: {
          fields: params.fields,
          ...(params.updatedAt !== undefined && { updatedAt: params.updatedAt }),
        },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Failed to update record' }))
        const error = body as { message?: string; code?: string; field?: string }
        // eslint-disable-next-line functional/no-throw-statements -- TanStack Query expects thrown errors
        throw Object.assign(new Error(error.message ?? 'Failed to update record'), {
          code: error.code,
          field: error.field,
          // Carried so the retry policy can tell a transient failure from a
          // refusal, and so a conflict can be surfaced as one.
          status: res.status,
        })
      }

      return res.json()
    },
    ...(options?.retryTransientFailures === true && {
      retry: shouldRetrySave,
      retryDelay: saveRetryDelayMs,
    }),
    onSuccess: invalidate,
  })
}

// ---------------------------------------------------------------------------
// Delete record mutation
// ---------------------------------------------------------------------------

export function useDeleteRecord(tableId: string) {
  const invalidate = useInvalidateTableRecords(tableId)

  return useMutation({
    mutationFn: async (recordId: string) => {
      const res = await apiClient.api.tables[':tableId'].records[':recordId'].$delete({
        param: { tableId, recordId },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Failed to delete record' }))
        const error = body as { message?: string }
        // eslint-disable-next-line functional/no-throw-statements -- TanStack Query expects thrown errors
        throw new Error(error.message ?? 'Failed to delete record')
      }

      // DELETE returns 204 No Content — don't parse body
      return { success: true }
    },
    onSuccess: invalidate,
  })
}
