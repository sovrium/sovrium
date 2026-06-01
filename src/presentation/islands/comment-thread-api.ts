/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { CommentCreateResponse } from './comment-thread-types'

export function buildListUrl(props: {
  readonly tableName: string
  readonly recordId: string
  readonly limit: number
  readonly offset: number
  readonly sort: 'newest' | 'oldest'
}): string {
  const sortParam = props.sort === 'newest' ? 'createdAt:desc' : 'createdAt:asc'
  const params = new URLSearchParams({
    limit: String(props.limit),
    offset: String(props.offset),
    sort: sortParam,
  })
  return `/api/tables/${props.tableName}/records/${props.recordId}/comments?${params.toString()}`
}

export async function postComment(input: {
  readonly tableName: string
  readonly recordId: string
  readonly content: string
  readonly parentCommentId?: string
}): Promise<CommentCreateResponse> {
  const body =
    input.parentCommentId !== undefined
      ? { content: input.content, parentCommentId: input.parentCommentId }
      : { content: input.content }
  const response = await fetch(
    `/api/tables/${input.tableName}/records/${input.recordId}/comments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    }
  )
  if (!response.ok) {
    throw new Error(`Failed to post comment (${response.status})`)
  }
  return (await response.json()) as CommentCreateResponse
}

export async function patchComment(input: {
  readonly tableName: string
  readonly recordId: string
  readonly commentId: string
  readonly content: string
}): Promise<void> {
  const response = await fetch(
    `/api/tables/${input.tableName}/records/${input.recordId}/comments/${input.commentId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ content: input.content }),
    }
  )
  if (!response.ok) {
    throw new Error(`Failed to update comment (${response.status})`)
  }
}

export async function deleteCommentApi(input: {
  readonly tableName: string
  readonly recordId: string
  readonly commentId: string
}): Promise<void> {
  const response = await fetch(
    `/api/tables/${input.tableName}/records/${input.recordId}/comments/${input.commentId}`,
    { method: 'DELETE', credentials: 'include' }
  )
  if (!response.ok) {
    throw new Error(`Failed to delete comment (${response.status})`)
  }
}
