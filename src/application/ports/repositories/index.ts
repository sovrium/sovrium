/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export {
  ActivityLogRepository,
  ActivityLogDatabaseError,
  type ActivityLog,
} from './analytics/activity-log-repository'
export {
  AnalyticsRepository,
  AnalyticsDatabaseError,
  type PageViewInput,
  type AnalyticsQueryParams,
  type TimeSeriesPoint,
  type AnalyticsSummary,
  type TopPage,
  type TopReferrer,
  type BreakdownEntry,
  type DeviceBreakdown,
  type CampaignEntry,
} from './analytics/analytics-repository'
export { ActivityRepository, type ActivityHistoryEntry } from './analytics/activity-repository'
export { AuthRepository, AuthDatabaseError } from './auth/auth-repository'
export {
  BatchRepository,
  type BatchValidationError,
  type UpsertResult,
} from './tables/batch-repository'
export {
  CommentRepository,
  type CommentWithUser,
  type CommentForAuth,
  type CommentUser,
  type ListedComment,
} from './comment-repository'
export {
  TableRepository,
  type QueryFilter,
  type AggregateQuery,
  type AggregationResult,
} from './tables/table-repository'
export {
  DataSourceRepository,
  DataSourceDatabaseError,
  type DataSourceQueryOptions,
} from './tables/data-source-repository'
export {
  AppVersionRepository,
  AppVersionDatabaseError,
  type CreateAppVersionInput,
} from './app/app-version-repository'
export {
  AppDraftRepository,
  AppDraftDatabaseError,
  type UpsertAppDraftInput,
} from './app/app-draft-repository'
export {
  BootstrapTokenRepository,
  BootstrapTokenDatabaseError,
} from './auth/bootstrap-token-repository'
export {
  PreviewSessionRepository,
  PreviewSessionDatabaseError,
  type CreatePreviewSessionInput,
} from './app/preview-session-repository'
