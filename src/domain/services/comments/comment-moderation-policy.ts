/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export type CommentModerationStatus = 'pending' | 'approved'

export interface CommentModerationConfig {
  readonly moderation?: boolean | 'auto' | 'manual' | 'auth-required'
  readonly autoApprove?: {
    readonly authenticated?: boolean
    readonly previouslyApproved?: boolean
  }
}

export interface CommentModerationContext {
  readonly isAuthenticated: boolean
  readonly priorApprovedCommentExists?: boolean
}

export function isModerationEnabled(config: CommentModerationConfig): boolean {
  const value = config.moderation
  if (value === undefined) return false
  if (value === false) return false
  if (value === 'auto') return false
  if (value === 'auth-required') return false
  return true
}

export function resolveCommentModerationStatus(
  config: CommentModerationConfig,
  context: CommentModerationContext
): CommentModerationStatus {
  if (!isModerationEnabled(config)) return 'approved'

  const autoApprove = config.autoApprove ?? {}

  if (autoApprove.authenticated === true && context.isAuthenticated) {
    return 'approved'
  }

  if (autoApprove.previouslyApproved === true && context.priorApprovedCommentExists === true) {
    return 'approved'
  }

  return 'pending'
}

export function requiresAuthenticationForComment(config: CommentModerationConfig): boolean {
  return config.moderation === 'auth-required'
}
