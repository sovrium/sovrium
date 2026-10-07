/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteCommentApi, patchComment, postComment } from './comment-thread-api'

interface CommentMutationsParams {
  readonly tableName: string
  readonly recordId: string
  /** Forget the pages already loaded — a new comment or reply lands on page one. */
  readonly onListReset: () => void
}

/**
 * The thread's four writes — post, edit, delete and reply — each refreshing
 * the thread and its comment count once it lands.
 */
export function useCommentMutations({ tableName, recordId, onListReset }: CommentMutationsParams) {
  const queryClient = useQueryClient()

  const invalidateAll = (): void => {
    queryClient.invalidateQueries({ queryKey: ['comments', tableName, recordId] })
    queryClient.invalidateQueries({ queryKey: ['comment-count', tableName, recordId] })
  }

  const createMutation = useMutation({
    mutationFn: (content: string) => postComment({ tableName, recordId, content }),
    onSuccess: () => {
      onListReset()
      invalidateAll()
    },
  })

  const editMutation = useMutation({
    mutationFn: (input: { readonly commentId: string; readonly content: string }) =>
      patchComment({ tableName, recordId, commentId: input.commentId, content: input.content }),
    onSuccess: () => invalidateAll(),
  })

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => deleteCommentApi({ tableName, recordId, commentId }),
    onSuccess: () => invalidateAll(),
  })

  const replyMutation = useMutation({
    mutationFn: (input: { readonly parentCommentId: string; readonly content: string }) =>
      postComment({
        tableName,
        recordId,
        content: input.content,
        parentCommentId: input.parentCommentId,
      }),
    onSuccess: () => {
      onListReset()
      invalidateAll()
    },
  })

  return { createMutation, editMutation, deleteMutation, replyMutation }
}
