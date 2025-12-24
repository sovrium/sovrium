/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Audit Logging - Security Event Tracking
 *
 * Domain: api/security
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (5 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * Tests audit logging mechanisms that track:
 * - Failed login attempts (brute force detection)
 * - Password changes (account security events)
 * - Permission changes (privilege escalation tracking)
 * - Sensitive data access (compliance and forensics)
 * - Log retention (90+ days for audit trail)
 *
 * Audit logging is critical for:
 * 1. Security Incident Response: Investigate breaches and attacks
 * 2. Compliance: Meet regulatory requirements (GDPR, SOC 2, HIPAA)
 * 3. Forensics: Reconstruct sequence of events
 * 4. Anomaly Detection: Identify suspicious patterns
 *
 * Better Auth can integrate with logging middleware for audit trails.
 *
 * Error Response Structure:
 * - Audit errors: `{ error: string }` - Generic API error format
 * - Better Auth errors: `{ message: string }` - Authentication-specific format
 * - See docs/architecture/testing-strategy/status-code-guidelines.md for details
 */

test.describe('Audit Logging - Security Event Tracking', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-SECURITY-AUDIT-001: should log failed login attempts',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, executeQuery }) => {
      // GIVEN: Application with audit logging enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        security: {
          auditLogging: {
            enabled: true,
            events: ['auth.login.failed'],
          },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'CorrectPass123!',
      })

      // WHEN: User attempts to sign in with wrong password
      const failedAttempt1 = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'test@example.com',
          password: 'WrongPassword1',
        },
      })

      expect(failedAttempt1.status()).toBe(401)

      // WHEN: User attempts to sign in with non-existent email
      const failedAttempt2 = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'nonexistent@example.com',
          password: 'AnyPassword123!',
        },
      })

      expect(failedAttempt2.status()).toBe(401)

      // THEN: Failed attempts should be logged in audit table
      const auditLogs = await executeQuery(
        `SELECT * FROM audit_logs WHERE event_type = 'auth.login.failed' ORDER BY created_at DESC LIMIT 2`
      )

      expect(auditLogs.rows.length).toBe(2)

      // THEN: Log should contain relevant metadata
      const log1 = auditLogs.rows[0]
      expect(log1.event_type).toBe('auth.login.failed')
      expect(log1.metadata).toContain('test@example.com') // Or parsed JSON
      expect(log1.ip_address).toBeDefined()
      expect(log1.user_agent).toBeDefined()
      expect(log1.created_at).toBeDefined()

      const log2 = auditLogs.rows[1]
      expect(log2.event_type).toBe('auth.login.failed')
      expect(log2.metadata).toContain('nonexistent@example.com')
    }
  )

  test.fixme(
    'API-SECURITY-AUDIT-002: should log password changes',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn, executeQuery }) => {
      // GIVEN: Application with audit logging enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        security: {
          auditLogging: {
            enabled: true,
            events: ['auth.password.changed'],
          },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'OldPassword123!',
      })

      await signIn({
        email: 'test@example.com',
        password: 'OldPassword123!',
      })

      // WHEN: User changes password
      const changePasswordResponse = await page.request.post('/api/auth/change-password', {
        data: {
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword456!',
        },
      })

      expect(changePasswordResponse.status()).toBe(200)

      // THEN: Password change should be logged
      const auditLogs = await executeQuery(
        `SELECT * FROM audit_logs WHERE event_type = 'auth.password.changed' ORDER BY created_at DESC LIMIT 1`
      )

      expect(auditLogs.rows.length).toBe(1)

      const log = auditLogs.rows[0]
      expect(log.event_type).toBe('auth.password.changed')
      expect(log.user_id).toBeDefined() // User who changed password
      expect(log.metadata).toContain('test@example.com') // Or parsed JSON
      expect(log.ip_address).toBeDefined()
      expect(log.created_at).toBeDefined()

      // THEN: Log should NOT contain password (only metadata)
      expect(log.metadata).not.toContain('OldPassword123!')
      expect(log.metadata).not.toContain('NewPassword456!')
    }
  )

  test.fixme(
    'API-SECURITY-AUDIT-003: should log permission changes',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn, executeQuery }) => {
      // GIVEN: Application with role-based permissions and audit logging
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          roles: ['admin', 'member', 'viewer'],
        },
        security: {
          auditLogging: {
            enabled: true,
            events: ['auth.role.changed', 'auth.permission.changed'],
          },
        },
      })

      const adminUser = await signUp({
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'AdminPass123!',
        role: 'admin',
      })

      const targetUser = await signUp({
        name: 'Target User',
        email: 'target@example.com',
        password: 'TargetPass123!',
        role: 'viewer',
      })

      await signIn({
        email: 'admin@example.com',
        password: 'AdminPass123!',
      })

      // WHEN: Admin changes user's role
      const changeRoleResponse = await page.request.post('/api/admin/users/change-role', {
        data: {
          userId: targetUser.id,
          newRole: 'member',
        },
      })

      expect(changeRoleResponse.status()).toBe(200)

      // THEN: Role change should be logged
      const auditLogs = await executeQuery(
        `SELECT * FROM audit_logs WHERE event_type = 'auth.role.changed' ORDER BY created_at DESC LIMIT 1`
      )

      expect(auditLogs.rows.length).toBe(1)

      const log = auditLogs.rows[0]
      expect(log.event_type).toBe('auth.role.changed')
      expect(log.user_id).toBe(adminUser.id) // Who made the change
      expect(log.metadata).toContain(targetUser.id) // Target user
      expect(log.metadata).toContain('viewer') // Old role
      expect(log.metadata).toContain('member') // New role
      expect(log.created_at).toBeDefined()
    }
  )

  test.fixme(
    'API-SECURITY-AUDIT-004: should log sensitive data access',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn, executeQuery }) => {
      // GIVEN: Application with sensitive data and audit logging
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        security: {
          auditLogging: {
            enabled: true,
            events: ['data.sensitive.accessed'],
          },
        },
        tables: [
          {
            id: 1,
            name: 'sensitive_records',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'ssn', type: 'single-line-text', sensitive: true },
              { id: 3, name: 'credit_card', type: 'single-line-text', sensitive: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      const user = await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!',
      })

      await signIn({
        email: 'test@example.com',
        password: 'SecurePass123!',
      })

      // WHEN: User accesses sensitive data
      const accessResponse = await page.request.get('/api/tables/sensitive_records/1')

      expect([200, 404]).toContain(accessResponse.status())

      // THEN: Sensitive data access should be logged
      const auditLogs = await executeQuery(
        `SELECT * FROM audit_logs WHERE event_type = 'data.sensitive.accessed' ORDER BY created_at DESC LIMIT 1`
      )

      expect(auditLogs.rows.length).toBe(1)

      const log = auditLogs.rows[0]
      expect(log.event_type).toBe('data.sensitive.accessed')
      expect(log.user_id).toBe(user.id)
      expect(log.metadata).toContain('sensitive_records') // Table name
      expect(log.metadata).toContain('1') // Record ID
      expect(log.ip_address).toBeDefined()
      expect(log.created_at).toBeDefined()
    }
  )

  test.fixme(
    'API-SECURITY-AUDIT-005: should retain logs for 90+ days',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, executeQuery }) => {
      // GIVEN: Application with audit log retention policy
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        security: {
          auditLogging: {
            enabled: true,
            retentionDays: 90,
          },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!',
      })

      // Create old audit log (simulate 95 days ago)
      const oldTimestamp = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString()
      await executeQuery(`
        INSERT INTO audit_logs (event_type, user_id, metadata, created_at)
        VALUES ('test.old.event', 1, '{"test": "data"}', '${oldTimestamp}')
      `)

      // WHEN: Triggering current event
      const failedAttempt = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'test@example.com',
          password: 'WrongPassword',
        },
      })

      expect(failedAttempt.status()).toBe(401)

      // THEN: Old logs (95+ days) should be purged
      const oldLogs = await executeQuery(
        `SELECT * FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days'`
      )

      expect(oldLogs.rows.length).toBe(0)

      // THEN: Recent logs (< 90 days) should be retained
      const recentLogs = await executeQuery(
        `SELECT * FROM audit_logs WHERE created_at >= NOW() - INTERVAL '90 days'`
      )

      expect(recentLogs.rows.length).toBeGreaterThan(0)

      // THEN: Retention policy should be enforced automatically
      // (This would typically be a scheduled job or database trigger)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-SECURITY-AUDIT-006: audit logging workflow tracks security events',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn, executeQuery }) => {
      await test.step('Setup: Start server with audit logging', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            roles: ['admin', 'member'],
          },
          security: {
            auditLogging: {
              enabled: true,
              events: [
                'auth.login.failed',
                'auth.password.changed',
                'auth.role.changed',
                'data.sensitive.accessed',
              ],
              retentionDays: 90,
            },
          },
          tables: [
            {
              id: 1,
              name: 'sensitive_data',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'secret', type: 'single-line-text', sensitive: true },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
      })

      await test.step('Verify: Failed login logged', async () => {
        await signUp({
          name: 'Test User',
          email: 'test@example.com',
          password: 'CorrectPass123!',
        })

        await page.request.post('/api/auth/sign-in/email', {
          data: {
            email: 'test@example.com',
            password: 'WrongPass',
          },
        })

        const logs = await executeQuery(
          `SELECT * FROM audit_logs WHERE event_type = 'auth.login.failed'`
        )
        expect(logs.rows.length).toBeGreaterThan(0)
      })

      await test.step('Verify: Password change logged', async () => {
        await signIn({
          email: 'test@example.com',
          password: 'CorrectPass123!',
        })

        await page.request.post('/api/auth/change-password', {
          data: {
            currentPassword: 'CorrectPass123!',
            newPassword: 'NewPass456!',
          },
        })

        const logs = await executeQuery(
          `SELECT * FROM audit_logs WHERE event_type = 'auth.password.changed'`
        )
        expect(logs.rows.length).toBe(1)
      })

      await test.step('Verify: Sensitive data access logged', async () => {
        await page.request.get('/api/tables/sensitive_data/1')

        const logs = await executeQuery(
          `SELECT * FROM audit_logs WHERE event_type = 'data.sensitive.accessed'`
        )
        expect(logs.rows.length).toBeGreaterThan(0)
      })

      await test.step('Verify: All logs have required metadata', async () => {
        const allLogs = await executeQuery(`SELECT * FROM audit_logs`)

        for (const log of allLogs.rows) {
          expect(log.event_type).toBeDefined()
          expect(log.created_at).toBeDefined()
          expect(log.ip_address).toBeDefined()
        }
      })
    }
  )
})
