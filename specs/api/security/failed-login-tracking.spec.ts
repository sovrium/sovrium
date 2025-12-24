/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Failed Login Tracking Security
 *
 * Priority: HIGH - Production security requirement
 * Domain: api/security
 * Spec Count: 2
 *
 * Validates that failed login attempts are logged with IP, timestamp, and user
 * information for security auditing. Includes detection of suspicious patterns.
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (2 tests)
 * 2. @regression test - ONE optimized integration test
 */

test.describe('Failed Login Tracking Security', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-SECURITY-FAILLOG-001: should log IP, timestamp, user on failed login',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Application with user authentication and failed login tracking enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          providers: ['email'],
          security: {
            failedLoginTracking: {
              enabled: true,
              retentionDays: 90,
            },
          },
        },
      })

      // AND: User account exists
      await request.post('/api/auth/sign-up/email', {
        data: {
          email: 'tracked@example.com',
          password: 'CorrectPassword123!',
          name: 'Tracked User',
        },
      })

      // WHEN: User attempts to log in with wrong password from specific IP
      const failedResponse = await request.post('/api/auth/sign-in/email', {
        headers: {
          'X-Forwarded-For': '192.168.1.100',
        },
        data: {
          email: 'tracked@example.com',
          password: 'WrongPassword123!',
        },
      })

      // THEN: Login fails
      expect(failedResponse.status()).toBe(401)

      // WHEN: Querying failed login logs
      const logs = await executeQuery(
        "SELECT * FROM failed_login_attempts WHERE email = 'tracked@example.com' ORDER BY attempted_at DESC LIMIT 1"
      )

      // THEN: Failed login is logged with IP, timestamp, and user
      expect(logs.length).toBe(1)
      expect(logs[0].email).toBe('tracked@example.com')
      expect(logs[0].ip_address).toBe('192.168.1.100')
      expect(logs[0].attempted_at).toBeDefined()
      expect(new Date(logs[0].attempted_at).getTime()).toBeGreaterThan(Date.now() - 5000) // Within last 5 seconds
      expect(logs[0].user_agent).toBeDefined()
    }
  )

  test.fixme(
    'API-SECURITY-FAILLOG-002: should detect suspicious patterns (10+ failed attempts in 5 minutes)',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Application with user authentication and pattern detection enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          providers: ['email'],
          security: {
            failedLoginTracking: {
              enabled: true,
              retentionDays: 90,
              suspiciousPatternThreshold: {
                maxAttempts: 10,
                timeWindow: 300, // 5 minutes in seconds
              },
            },
          },
        },
      })

      // AND: User account exists
      await request.post('/api/auth/sign-up/email', {
        data: {
          email: 'suspicious@example.com',
          password: 'CorrectPassword123!',
          name: 'Suspicious Pattern User',
        },
      })

      // WHEN: User triggers 10 failed login attempts from same IP
      const ipAddress = '203.0.113.50'

      for (let i = 0; i < 10; i++) {
        await request.post('/api/auth/sign-in/email', {
          headers: {
            'X-Forwarded-For': ipAddress,
          },
          data: {
            email: 'suspicious@example.com',
            password: `WrongPassword${i}!`,
          },
        })
      }

      // WHEN: Querying security alerts
      const alerts = await executeQuery(
        `SELECT * FROM security_alerts WHERE alert_type = 'suspicious_login_pattern' AND ip_address = '${ipAddress}' ORDER BY created_at DESC LIMIT 1`
      )

      // THEN: Suspicious pattern is detected and logged
      expect(alerts.length).toBe(1)
      expect(alerts[0].alert_type).toBe('suspicious_login_pattern')
      expect(alerts[0].ip_address).toBe(ipAddress)
      expect(alerts[0].email).toBe('suspicious@example.com')
      expect(alerts[0].failed_attempts_count).toBeGreaterThanOrEqual(10)
      expect(alerts[0].time_window_minutes).toBe(5)
      expect(alerts[0].severity).toBe('high')

      // WHEN: Admin queries security dashboard
      const dashboardResponse = await request.get('/api/admin/security/alerts')

      // THEN: Dashboard shows suspicious pattern alert
      expect(dashboardResponse.ok()).toBe(true)
      const dashboardData = await dashboardResponse.json()
      expect(dashboardData.alerts).toContainEqual(
        expect.objectContaining({
          type: 'suspicious_login_pattern',
          ip: ipAddress,
          email: 'suspicious@example.com',
        })
      )
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-SECURITY-FAILLOG-003: user can complete full failed login tracking workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Application with authentication and tracking enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          providers: ['email'],
          security: {
            failedLoginTracking: {
              enabled: true,
              retentionDays: 90,
              suspiciousPatternThreshold: {
                maxAttempts: 10,
                timeWindow: 300,
              },
            },
          },
        },
      })

      // AND: User account exists
      await request.post('/api/auth/sign-up/email', {
        data: {
          email: 'workflow@example.com',
          password: 'CorrectPassword123!',
          name: 'Workflow User',
        },
      })

      // WHEN: User triggers failed login from specific IP
      const ipAddress = '198.51.100.75'
      await request.post('/api/auth/sign-in/email', {
        headers: { 'X-Forwarded-For': ipAddress },
        data: { email: 'workflow@example.com', password: 'WrongPassword!' },
      })

      // THEN: Failed login is logged
      const logs = await executeQuery(
        `SELECT * FROM failed_login_attempts WHERE email = 'workflow@example.com' AND ip_address = '${ipAddress}'`
      )
      expect(logs.length).toBe(1)
      expect(logs[0].email).toBe('workflow@example.com')
      expect(logs[0].ip_address).toBe(ipAddress)

      // WHEN: Triggering 10+ failed attempts (suspicious pattern)
      for (let i = 0; i < 10; i++) {
        await request.post('/api/auth/sign-in/email', {
          headers: { 'X-Forwarded-For': ipAddress },
          data: { email: 'workflow@example.com', password: `Wrong${i}!` },
        })
      }

      // THEN: Suspicious pattern is detected
      const alerts = await executeQuery(
        `SELECT * FROM security_alerts WHERE alert_type = 'suspicious_login_pattern' AND ip_address = '${ipAddress}'`
      )
      expect(alerts.length).toBeGreaterThan(0)
      expect(alerts[0].failed_attempts_count).toBeGreaterThanOrEqual(10)
    }
  )
})
