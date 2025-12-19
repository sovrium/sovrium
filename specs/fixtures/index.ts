/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Fixtures module - organized utilities and types for E2E testing
 *
 * This module exports:
 * - Type definitions (types.ts)
 * - Server utilities (server.ts)
 * - CLI utilities (cli.ts)
 * - Database/RLS testing utilities (database.ts)
 * - Main Playwright test fixture (re-exported from ../fixtures.ts)
 */

// Export all types
export type * from './types'

// Export server utilities
export {
  initializeGlobalDatabase,
  cleanupGlobalDatabase,
  killAllServerProcesses,
  startCliServer,
  stopServer,
  getTemplateManager,
  generateTestDatabaseName,
} from './server'

// Export CLI utilities
export {
  createTempConfigFile,
  cleanupTempConfigFile,
  startCliWithConfigFile,
  captureCliOutput,
} from './cli'

// Export database/RLS testing utilities
export {
  splitSQLStatements,
  executeStatementsInTransaction,
  executeQueryAsRole,
  generateRoleName,
  verifyRlsPolicyExists,
  getRlsPolicies,
  verifyRlsEnabled,
  expectQueryToSucceed,
  expectQueryToFailWithRls,
  expectQueryToReturnZeroRows,
  verifyRecordExists,
  verifyRecordNotExists,
  createMultiOrgScenario,
} from './database'

// Re-export test and expect from parent fixtures.ts
// (parent contains the main Playwright test.extend implementation)
export { test, expect } from '../fixtures'
export type { Locator } from '@playwright/test'
export type { MailpitEmail } from './email-utils'
