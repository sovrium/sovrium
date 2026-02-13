/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import { CommentRepository } from '@/application/ports/comment-repository'
import {
  createComment,
  getCommentWithUser,
  checkRecordExists,
  getCommentForAuth,
  getUserById,
  deleteComment,
  listComments,
  getCommentsCount,
  updateComment,
} from '@/infrastructure/database/table-queries/comment-queries'

/**
 * Live implementation of CommentRepository using comment-queries infrastructure
 *
 * Maps port method names to infrastructure function names.
 */
export const CommentRepositoryLive = Layer.succeed(CommentRepository, {
  create: createComment,
  getWithUser: getCommentWithUser,
  checkRecordExists,
  getForAuth: getCommentForAuth,
  getUserById,
  remove: deleteComment,
  list: listComments,
  getCount: getCommentsCount,
  update: updateComment,
})
