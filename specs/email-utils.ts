/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { execSync } from 'node:child_process'
import { isDockerRunning } from './docker-utils'

/**
 * Email received by Mailpit
 */
export type MailpitEmail = {
  ID: string
  From: {
    Name: string
    Address: string
  }
  To: Array<{
    Name: string
    Address: string
  }>
  Cc?: Array<{
    Name: string
    Address: string
  }>
  Bcc?: Array<{
    Name: string
    Address: string
  }>
  ReplyTo?: Array<{
    Name: string
    Address: string
  }>
  Subject: string
  Text: string
  HTML: string
  Created: string
}

/**
 * Mailpit API response for messages list
 */
export type MailpitMessageList = {
  messages: MailpitEmail[]
  total: number
  count: number
}

/**
 * Mailpit configuration options
 */
export type MailpitOptions = {
  /** Web UI port (default: 8025) */
  webPort?: number
  /** SMTP port (default: 1025) */
  smtpPort?: number
  /** Docker container name (default: 'mailpit-test') */
  containerName?: string
}

/**
 * Global Mailpit container state
 * Shared across all tests - started once in global setup
 */
let globalMailpitStarted = false
const globalSmtpPort = 1025
const globalWebPort = 8025
const globalContainerName = 'sovrium-mailpit-e2e'

/**
 * Find docker executable path
 */
function findDockerPath(): string {
  const paths = ['/opt/homebrew/bin/docker', '/usr/local/bin/docker', '/usr/bin/docker']
  for (const path of paths) {
    try {
      execSync(`test -x ${path}`, { stdio: 'ignore' })
      return path
    } catch {
      // Continue checking
    }
  }
  return 'docker' // Fallback to PATH
}

/**
 * Check if Mailpit container is running
 */
export function isMailpitRunning(): boolean {
  const dockerPath = findDockerPath()
  try {
    const result = execSync(
      `${dockerPath} ps --filter name=${globalContainerName} --format "{{.Names}}"`,
      { encoding: 'utf-8' }
    )
    return result.trim() === globalContainerName
  } catch {
    return false
  }
}

/**
 * Start global Mailpit container
 * Called once in global setup - container is shared across all tests
 */
export async function startGlobalMailpit(): Promise<void> {
  if (globalMailpitStarted && isMailpitRunning()) {
    console.log('📧 Mailpit already running')
    return
  }

  if (!isDockerRunning()) {
    throw new Error(
      'Docker is not running. Please ensure Docker is started before running E2E tests.'
    )
  }

  const dockerPath = findDockerPath()

  try {
    // Check if container exists but is stopped
    const existsResult = execSync(
      `${dockerPath} ps -a --filter name=${globalContainerName} --format "{{.Names}}"`,
      { encoding: 'utf-8' }
    )

    if (existsResult.trim() === globalContainerName) {
      // Container exists, check if running
      if (!isMailpitRunning()) {
        console.log('📧 Starting existing Mailpit container...')
        execSync(`${dockerPath} start ${globalContainerName}`, { stdio: 'ignore' })
      }
    } else {
      // Create new container
      console.log('📧 Starting new Mailpit container...')
      execSync(
        `${dockerPath} run -d --name ${globalContainerName} ` +
          `-p ${globalSmtpPort}:1025 -p ${globalWebPort}:8025 axllent/mailpit`,
        { stdio: 'ignore' }
      )
    }

    // Wait for Mailpit to be ready
    await waitForMailpitReady()
    globalMailpitStarted = true
    console.log(`✅ Mailpit ready (SMTP: ${globalSmtpPort}, Web: ${globalWebPort})`)
  } catch (error) {
    throw new Error(`Failed to start Mailpit: ${error}`)
  }
}

/**
 * Stop global Mailpit container
 * Called in global teardown
 */
export async function stopGlobalMailpit(): Promise<void> {
  const dockerPath = findDockerPath()
  try {
    execSync(`${dockerPath} stop ${globalContainerName}`, { stdio: 'ignore' })
    execSync(`${dockerPath} rm ${globalContainerName}`, { stdio: 'ignore' })
    globalMailpitStarted = false
    console.log('✅ Mailpit stopped')
  } catch {
    // Container might not exist, ignore errors
  }
}

/**
 * Wait for Mailpit to be ready
 */
async function waitForMailpitReady(maxAttempts = 30): Promise<void> {
  const baseUrl = `http://localhost:${globalWebPort}`
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${baseUrl}/api/v1/messages`)
      if (response.ok) {
        return
      }
    } catch {
      // Not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Mailpit did not become ready in time')
}

/**
 * Mailpit Helper for E2E Email Testing
 *
 * Provides utilities to interact with Mailpit SMTP server and web API.
 * Each test gets its own isolated mailbox by clearing emails before/after tests.
 *
 * @example
 * ```typescript
 * const mailpit = new MailpitHelper()
 *
 * // Clear mailbox before test
 * await mailpit.clearEmails()
 *
 * // ... trigger email sending in your app ...
 *
 * // Wait for email to arrive
 * const email = await mailpit.waitForEmail(
 *   (e) => e.To[0].Address === 'user@example.com'
 * )
 *
 * // Verify email content
 * expect(email.Subject).toBe('Welcome!')
 * expect(email.From.Address).toBe('noreply@myapp.com')
 * ```
 */
export class MailpitHelper {
  private readonly baseUrl: string
  private readonly smtpPort: number

  constructor(options?: MailpitOptions) {
    const webPort = options?.webPort ?? globalWebPort
    this.smtpPort = options?.smtpPort ?? globalSmtpPort
    this.baseUrl = `http://localhost:${webPort}`
  }

  /**
   * Clear all emails in the mailbox
   * Call this at the start of each test for isolation
   */
  async clearEmails(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/messages`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error(`Failed to clear emails: ${response.status}`)
      }
    } catch (error) {
      throw new Error(`Failed to clear emails: ${error}`)
    }
  }

  /**
   * Get all emails in the mailbox
   */
  async getEmails(): Promise<MailpitEmail[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/messages`)
      if (!response.ok) {
        throw new Error(`Failed to get emails: ${response.status}`)
      }
      const data = (await response.json()) as MailpitMessageList
      return data.messages || []
    } catch (error) {
      throw new Error(`Failed to get emails: ${error}`)
    }
  }

  /**
   * Get email count
   */
  async getEmailCount(): Promise<number> {
    const emails = await this.getEmails()
    return emails.length
  }

  /**
   * Wait for an email matching the predicate to arrive
   *
   * @param predicate - Function to match the expected email
   * @param options - Timeout and polling options
   * @returns The matching email
   * @throws Error if no matching email arrives within timeout
   *
   * @example
   * ```typescript
   * // Wait for email to specific recipient
   * const email = await mailpit.waitForEmail(
   *   (e) => e.To[0].Address === 'user@example.com'
   * )
   *
   * // Wait for email with specific subject
   * const email = await mailpit.waitForEmail(
   *   (e) => e.Subject === 'Password Reset'
   * )
   * ```
   */
  async waitForEmail(
    predicate: (email: MailpitEmail) => boolean,
    options?: { timeout?: number; interval?: number }
  ): Promise<MailpitEmail> {
    const timeout = options?.timeout ?? 10_000
    const interval = options?.interval ?? 100
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const emails = await this.getEmails()
      const email = emails.find(predicate)
      if (email) {
        return email
      }
      await new Promise((resolve) => setTimeout(resolve, interval))
    }

    throw new Error(`Email not found within ${timeout}ms`)
  }

  /**
   * Get email by ID (for detailed content)
   */
  async getEmailById(id: string): Promise<MailpitEmail> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/message/${id}`)
      if (!response.ok) {
        throw new Error(`Failed to get email: ${response.status}`)
      }
      return (await response.json()) as MailpitEmail
    } catch (error) {
      throw new Error(`Failed to get email: ${error}`)
    }
  }

  /**
   * Get SMTP configuration for the email schema
   * Use these values in your app's email config to send to Mailpit
   */
  getSmtpConfig() {
    return {
      host: 'localhost',
      port: this.smtpPort,
      secure: false,
    }
  }

  /**
   * Get full email configuration matching the app schema
   */
  getEmailConfig(from: string, options?: { fromName?: string; replyTo?: string }) {
    return {
      from,
      fromName: options?.fromName,
      replyTo: options?.replyTo,
      host: 'localhost',
      port: this.smtpPort,
      secure: false,
      preview: false,
    }
  }
}
