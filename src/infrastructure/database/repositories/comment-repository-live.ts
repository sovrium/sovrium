/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { CommentRepository } from '@/application/ports/repositories/comment-repository'
import { layerOverDatabase } from '@/infrastructure/database/drizzle/layer'
import { getCommentForAuth } from '@/infrastructure/database/table-queries/query-helpers/comment-auth-queries'
import {
  listCommentAuthorsForRecord,
  listCommentAuthorEmailsForRecord,
  getUserEmailById,
  getUserMetadataById,
} from '@/infrastructure/database/table-queries/query-helpers/comment-author-email-queries'
import { hasApprovedGuestComment } from '@/infrastructure/database/table-queries/query-helpers/comment-moderation-queries'
import {
  createComment,
  getCommentWithUser,
  deleteComment,
  listComments,
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

/**
 * Live implementation of CommentRepository using comment-queries infrastructure
 *
 * Maps port method names to infrastructure function names.
 */
export const CommentRepositoryLive = layerOverDatabase(CommentRepository, {
  create: (db) => (config) => createComment(db, config),
  getWithUser: (db) => (config) => getCommentWithUser(db, config),
  hasApprovedGuestComment: (db) => (config) => hasApprovedGuestComment(db, config),
  checkRecordExists: (db, dialect) => (config) =>
    checkRecordExists({ client: db, dialect }, config),
  getForAuth: (db) => (config) => getCommentForAuth(db, config),
  getUserById: (db) => (config) => getUserById(db, config),
  remove: (db) => (config) => deleteComment(db, config),
  list: (db) => (config) => listComments(db, config),
  listAuthorsForRecord: (db) => (config) => listCommentAuthorsForRecord(db, config),
  listAuthorEmailsForRecord: (db) => (config) => listCommentAuthorEmailsForRecord(db, config),
  getUserEmailById: (db) => (config) => getUserEmailById(db, config),
  getUserMetadataById: (db) => (config) => getUserMetadataById(db, config),
  getCount: (db, dialect) => (config) => getCommentsCount(db, dialect, config),
  update: (db) => (config) => updateComment(db, config),
  updateStatus: (db) => (config) => updateCommentStatus(db, config),
  markRead: (db) => (config) => markRecordCommentsRead(db, config),
  countUnread: (db, dialect) => (config) => getUnreadCommentCount(db, dialect, config),
})
