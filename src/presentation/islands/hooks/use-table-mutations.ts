/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createRecordsClient } from '@/presentation/api/client'
import type { CreateRecordRequest, UpdateRecordRequest } from '@/domain/models/api/tables/records'


const apiClient = createRecordsClient(typeof window !== 'undefined' ? window.location.origin : '')


function useInvalidateTableRecords(tableId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['table-records', tableId] })
}


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
        throw new Error(error.message ?? 'Failed to delete record')
      }

      return { success: true }
    },
    onSuccess: invalidate,
  })
}


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
        throw new Error(error.message ?? 'Failed to create comment')
      }

      return res.json()
    },
  })
}


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
        throw new Error(error.message ?? 'Failed to update comment')
      }

      return res.json()
    },
  })
}


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
        throw new Error(error.message ?? 'Failed to delete comment')
      }

      return res.json()
    },
  })
}
