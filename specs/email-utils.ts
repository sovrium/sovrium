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
  /** Unique test ID for isolation (auto-generated if not provided) */
  testId?: string
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
 * Generate a unique test ID for email isolation
 * Uses timestamp + random suffix for uniqueness
 */
export function generateTestId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `t${timestamp}${random}`
}

/**
 * Mailpit Helper for E2E Email Testing
 *
 * Provides utilities to interact with Mailpit SMTP server and web API.
 * Each test gets its own isolated namespace via testId - emails are filtered
 * by this ID to prevent test interference when running in parallel.
 *
 * @example
 * ```typescript
 * const mailpit = new MailpitHelper({ testId: 'test123' })
 *
 * // Generate namespaced email address for this test
 * const email = mailpit.email('user') // 'user-test123@test.local'
 *
 * // ... trigger email sending in your app using the namespaced address ...
 *
 * // Wait for email to arrive (automatically filtered by testId)
 * const received = await mailpit.waitForEmail(
 *   (e) => e.To[0]?.Address === mailpit.email('user')
 * )
 *
 * // Verify email content
 * expect(received.Subject).toBe('Welcome!')
 * ```
 */
export class MailpitHelper {
  private readonly baseUrl: string
  private readonly smtpPort: number
  /** Unique test ID for email isolation */
  readonly testId: string
  /** Email domain used for test emails */
  readonly domain = 'test.local'

  constructor(options?: MailpitOptions) {
    const webPort = options?.webPort ?? globalWebPort
    this.smtpPort = options?.smtpPort ?? globalSmtpPort
    this.baseUrl = `http://localhost:${webPort}`
    this.testId = options?.testId ?? generateTestId()
  }

  /**
   * Generate a namespaced email address for this test
   * Creates addresses like: user-t1234abc@test.local
   *
   * @param localPart - The local part of the email (e.g., 'user', 'admin')
   * @returns Namespaced email address unique to this test
   *
   * @example
   * mailpit.email('user')     // 'user-t1234abc@test.local'
   * mailpit.email('admin')    // 'admin-t1234abc@test.local'
   * mailpit.email('new')      // 'new-t1234abc@test.local'
   */
  email(localPart: string): string {
    return `${localPart}-${this.testId}@${this.domain}`
  }

  /**
   * Check if an email address belongs to this test's namespace
   */
  isOwnEmail(address: string): boolean {
    return address.includes(`-${this.testId}@`)
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
   * Get all emails in the mailbox (unfiltered)
   * For most use cases, prefer getOwnEmails() which filters by testId
   */
  async getAllEmails(): Promise<MailpitEmail[]> {
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
   * Get emails belonging to this test's namespace only
   * Filters by testId in recipient addresses for test isolation
   */
  async getEmails(): Promise<MailpitEmail[]> {
    const allEmails = await this.getAllEmails()
    return allEmails.filter((email) => email.To.some((to) => this.isOwnEmail(to.Address)))
  }

  /**
   * Get email count for this test's namespace
   */
  async getEmailCount(): Promise<number> {
    const emails = await this.getEmails()
    return emails.length
  }

  /**
   * Wait for an email matching the predicate to arrive
   * Automatically filters to only emails in this test's namespace
   *
   * @param predicate - Function to match the expected email
   * @param options - Timeout and polling options
   * @returns The matching email
   * @throws Error if no matching email arrives within timeout
   *
   * @example
   * ```typescript
   * // Wait for email to namespaced recipient
   * const email = await mailpit.waitForEmail(
   *   (e) => e.To[0]?.Address === mailpit.email('user')
   * )
   *
   * // Wait for email with specific subject (still filtered by testId)
   * const email = await mailpit.waitForEmail(
   *   (e) => e.Subject.toLowerCase().includes('password')
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
      const emails = await this.getEmails() // Already filtered by testId
      const email = emails.find(predicate)
      if (email) {
        return email
      }
      await new Promise((resolve) => setTimeout(resolve, interval))
    }

    throw new Error(`Email not found within ${timeout}ms (testId: ${this.testId})`)
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
   * Get the latest email sent to a specific address
   * Waits for the email to arrive if not immediately available
   *
   * @param toAddress - The recipient email address to search for
   * @param options - Timeout and polling options
   * @returns The latest email with normalized property names (lowercase)
   * @throws Error if no email to this address arrives within timeout
   *
   * @example
   * ```typescript
   * const email = await mailpit.getLatestEmail('user@example.com')
   * const token = email.html.match(/token=([^"&\s]+)/)?.[1]
   * ```
   */
  async getLatestEmail(
    toAddress: string,
    options?: { timeout?: number; interval?: number }
  ): Promise<{
    id: string
    from: { name: string; address: string }
    to: Array<{ name: string; address: string }>
    subject: string
    text: string
    html: string
    created: string
  }> {
    const timeout = options?.timeout ?? 10_000
    const interval = options?.interval ?? 100
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const allEmails = await this.getAllEmails()
      // Find emails sent to the specified address, sorted by creation time (newest first)
      const matchingEmails = allEmails
        .filter((email) => email.To.some((to) => to.Address === toAddress))
        .sort((a, b) => new Date(b.Created).getTime() - new Date(a.Created).getTime())

      const email = matchingEmails[0]
      if (email) {
        // Return normalized object with lowercase property names for convenience
        return {
          id: email.ID,
          from: { name: email.From.Name, address: email.From.Address },
          to: email.To.map((t) => ({ name: t.Name, address: t.Address })),
          subject: email.Subject,
          text: email.Text,
          html: email.HTML,
          created: email.Created,
        }
      }
      await new Promise((resolve) => setTimeout(resolve, interval))
    }

    throw new Error(`No email to ${toAddress} found within ${timeout}ms`)
  }

  /**
   * Get SMTP configuration environment variables for Mailpit
   * These should be set in process.env when starting the server
   */
  getSmtpEnv(from?: string, options?: { fromName?: string }) {
    return {
      SMTP_HOST: 'localhost',
      SMTP_PORT: this.smtpPort.toString(),
      SMTP_SECURE: 'false',
      ...(from && { SMTP_FROM: from }),
      ...(options?.fromName && { SMTP_FROM_NAME: options.fromName }),
    }
  }
}
