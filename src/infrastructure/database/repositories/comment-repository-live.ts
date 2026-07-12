/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import { CommentRepository } from '@/application/ports/repositories/comment-repository'
import {
  listCommentAuthorEmailsForRecord,
  getUserEmailById,
  getUserMetadataById,
} from '@/infrastructure/database/table-queries/query-helpers/comment-author-email-queries'
import {
  createComment,
  getCommentWithUser,
  getCommentForAuth,
  deleteComment,
  listComments,
  listCommentAuthorsForRecord,
  getCommentsCount,
  updateComment,
  updateCommentStatus,
} from '@/infrastructure/database/table-queries/query-helpers/comment-queries'
import {
  markRecordCommentsRead,
  getUnreadCommentCount,
} from '@/infrastructure/database/table-queries/query-helpers/comment-read-state-queries'
import {
  checkRecordExists,
  getUserById,
} from '@/infrastructure/database/table-queries/query-helpers/record-validation-queries'

export const CommentRepositoryLive = Layer.succeed(CommentRepository, {
  create: createComment,
  getWithUser: getCommentWithUser,
  checkRecordExists,
  getForAuth: getCommentForAuth,
  getUserById,
  remove: deleteComment,
  list: listComments,
  listAuthorsForRecord: listCommentAuthorsForRecord,
  listAuthorEmailsForRecord: listCommentAuthorEmailsForRecord,
  getUserEmailById,
  getUserMetadataById,
  getCount: getCommentsCount,
  update: updateComment,
  updateStatus: updateCommentStatus,
  markRead: markRecordCommentsRead,
  countUnread: getUnreadCommentCount,
})
