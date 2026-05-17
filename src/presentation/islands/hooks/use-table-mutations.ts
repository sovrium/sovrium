/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createRecordsClient } from '@/presentation/api/client'
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

export function useUpdateRecord(tableId: string) {
  const invalidate = useInvalidateTableRecords(tableId)

  return useMutation({
    mutationFn: async (params: {
      readonly recordId: string
      readonly fields: UpdateRecordRequest['fields']
    }) => {
      const res = await apiClient.api.tables[':tableId'].records[':recordId'].$patch({
        param: { tableId, recordId: params.recordId },
        json: { fields: params.fields },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Failed to update record' }))
        const error = body as { message?: string; code?: string; field?: string }
        // eslint-disable-next-line functional/no-throw-statements -- TanStack Query expects thrown errors
        throw Object.assign(new Error(error.message ?? 'Failed to update record'), {
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

// ---------------------------------------------------------------------------
// Create comment mutation
// ---------------------------------------------------------------------------

/** @public */
export function useCreateComment(tableId: string, recordId: string) {
  return useMutation({
    mutationFn: async (content: string) => {
      const res = await apiClient.api.tables[':tableId'].records[':recordId'].comments.$post({
        param: { tableId, recordId },
        json: { content },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Failed to create comment' }))
        const error = body as { message?: string }
        // eslint-disable-next-line functional/no-throw-statements -- TanStack Query expects thrown errors
        throw new Error(error.message ?? 'Failed to create comment')
      }

      return res.json()
    },
  })
}

// ---------------------------------------------------------------------------
// Update comment mutation
// ---------------------------------------------------------------------------

/** @public */
export function useUpdateComment(tableId: string, recordId: string) {
  return useMutation({
    mutationFn: async (params: { readonly commentId: string; readonly content: string }) => {
      const res = await apiClient.api.tables[':tableId'].records[':recordId'].comments[
        ':commentId'
      ].$patch({
        param: { tableId, recordId, commentId: params.commentId },
        json: { content: params.content },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Failed to update comment' }))
        const error = body as { message?: string }
        // eslint-disable-next-line functional/no-throw-statements -- TanStack Query expects thrown errors
        throw new Error(error.message ?? 'Failed to update comment')
      }

      return res.json()
    },
  })
}

// ---------------------------------------------------------------------------
// Delete comment mutation
// ---------------------------------------------------------------------------

/** @public */
export function useDeleteComment(tableId: string, recordId: string) {
  return useMutation({
    mutationFn: async (commentId: string) => {
      const res = await apiClient.api.tables[':tableId'].records[':recordId'].comments[
        ':commentId'
      ].$delete({
        param: { tableId, recordId, commentId },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Failed to delete comment' }))
        const error = body as { message?: string }
        // eslint-disable-next-line functional/no-throw-statements -- TanStack Query expects thrown errors
        throw new Error(error.message ?? 'Failed to delete comment')
      }

      return res.json()
    },
  })
}
