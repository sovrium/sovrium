/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The store failures an admin read can surface and the services it may
 * require, across every area of the admin read registry. The server's domain
 * layer provides all of them; a new area appends its own here.
 */

import type { AuditLogRepository } from '@/application/ports/repositories/admin/audit-log-repository'
import type {
  BootLedgerDatabaseError,
  BootLedgerRepository,
} from '@/application/ports/repositories/admin/boot-ledger-repository'
import type {
  AdminSearchDatabaseError,
  AdminSearchRepository,
} from '@/application/ports/repositories/admin-search-repository'
import type {
  AdminAgentConversationsDatabaseError,
  AdminAgentConversationsRepository,
} from '@/application/ports/repositories/agents/admin-agent-conversations-repository'
import type { AnalyticsRepository } from '@/application/ports/repositories/analytics/analytics-repository'
import type {
  AuthDatabaseError,
  AuthRepository,
} from '@/application/ports/repositories/auth/auth-repository'
import type {
  InvitationTokenDatabaseError,
  InvitationTokenRepository,
} from '@/application/ports/repositories/auth/invitation-token-repository'
import type { OrganizationTeamRepository } from '@/application/ports/repositories/auth/organization-team-repository'
import type {
  AdminAutomationsDatabaseError,
  AdminAutomationsRepository,
} from '@/application/ports/repositories/automations/admin-automations-repository'
import type {
  AutomationPauseDatabaseError,
  AutomationPauseRepository,
} from '@/application/ports/repositories/automations/automation-pause-repository'
import type { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import type {
  AdminBucketFilesDatabaseError,
  AdminBucketFilesRepository,
} from '@/application/ports/repositories/buckets/admin-bucket-files-repository'
import type {
  ConnectionDatabaseError,
  ConnectionRepository,
} from '@/application/ports/repositories/connections/connection-repository'
import type {
  ConnectionTokenDatabaseError,
  ConnectionTokenRepository,
} from '@/application/ports/repositories/connections/connection-token-repository'
import type {
  DesignSystemShareDatabaseError,
  DesignSystemShareRepository,
} from '@/application/ports/repositories/design-system/design-system-share-repository'
import type {
  AdminFormsDatabaseError,
  AdminFormsRepository,
} from '@/application/ports/repositories/forms/admin-forms-repository'
import type {
  LinkDbError,
  LinkRepository,
} from '@/application/ports/repositories/links/link-repository'
import type {
  TablesOverviewError,
  TablesOverviewRepository,
} from '@/application/ports/repositories/tables/tables-overview-repository'
import type {
  UsersDirectoryDatabaseError,
  UsersDirectoryRepository,
} from '@/application/ports/repositories/tables/users-directory-repository'
import type {
  UsersOverviewDatabaseError,
  UsersOverviewRepository,
} from '@/application/ports/repositories/tables/users-overview-repository'
import type { AdminReadHost } from '@/application/ports/services/admin-read-host'
import type { StorageService } from '@/application/ports/services/storage-service'
import type { TemplateEngine } from '@/application/ports/services/template-engine'
import type { AdminAttentionServices } from '@/application/use-cases/admin/attention'
import type { AdminOverviewServices } from '@/application/use-cases/admin/overview'
import type { Logger } from '@/infrastructure/logging/logger'

/** The store failures an admin read can surface. Extend as areas join. */
export type AdminReadError =
  | AdminAutomationsDatabaseError
  | AutomationPauseDatabaseError
  | AuthDatabaseError
  | BootLedgerDatabaseError
  | AdminSearchDatabaseError
  | TablesOverviewError
  | LinkDbError
  | ConnectionDatabaseError
  | ConnectionTokenDatabaseError
  | AdminBucketFilesDatabaseError
  | AdminAgentConversationsDatabaseError
  | AdminFormsDatabaseError
  | UsersOverviewDatabaseError
  | UsersDirectoryDatabaseError
  | InvitationTokenDatabaseError
  | DesignSystemShareDatabaseError

/** The services an admin read requires. Extend as areas join. */
export type AdminReadServices =
  | AdminAutomationsRepository
  | AutomationRunRepository
  | AutomationPauseRepository
  | AuthRepository
  | AuditLogRepository
  | BootLedgerRepository
  | TablesOverviewRepository
  | AdminSearchRepository
  | AdminOverviewServices
  | AdminAttentionServices
  | AdminReadHost
  | LinkRepository
  | AnalyticsRepository
  | ConnectionRepository
  | ConnectionTokenRepository
  | AdminBucketFilesRepository
  | StorageService
  | TemplateEngine
  | Logger
  | AdminAgentConversationsRepository
  | AdminFormsRepository
  | UsersOverviewRepository
  | UsersDirectoryRepository
  | InvitationTokenRepository
  | OrganizationTeamRepository
  | DesignSystemShareRepository
