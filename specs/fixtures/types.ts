/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { MailpitHelper } from './email'
import type { App } from '@/domain/models/app'
import type { APIRequestContext } from '@playwright/test'
import type { ChildProcess } from 'node:child_process'

/**
 * Auth-related types for test fixtures
 */
export type AuthUser = {
  id: string
  email: string
  name: string
  emailVerified: boolean
  role?: string
  createdAt: string
  updatedAt: string
}

export type AuthSession = {
  id: string
  userId: string
  token: string
  expiresAt: string
}

export type SignUpData = {
  email: string
  password: string
  name: string
}

export type SignInData = {
  email: string
  password: string
  rememberMe?: boolean
}

export type AuthResult = {
  user: AuthUser
  session?: AuthSession
  token?: string // Convenience alias for session.token
}

/**
 * API Key types for test fixtures
 */
export type ApiKey = {
  id: string
  name: string | null
  key?: string // Only returned on creation
  userId: string
  expiresAt: string | null
  createdAt: string
  metadata?: Record<string, unknown>
}

export type ApiKeyCreateData = {
  name?: string
  expiresIn?: number // Seconds until expiration
  metadata?: Record<string, unknown>
}

export type ApiKeyResult = {
  id: string
  key: string // The actual API key value (shown only once)
  name: string | null
  expiresAt: string | null
  createdAt: string
  metadata?: Record<string, unknown>
}

/**
 * Two-Factor types for test fixtures
 */
export type TwoFactorSetupResult = {
  secret: string
  qrCode: string
  backupCodes?: string[]
}

export type TwoFactorVerifyResult = {
  success: boolean
}

/**
 * Admin types for test fixtures
 */
export type AdminCreateUserData = {
  email: string
  name: string
  password: string
  emailVerified?: boolean
  role?: string
}

export type AdminUserResult = {
  user: AuthUser & { role?: string }
}

/**
 * CLI Server result type for config file-based startup
 */
export type CliServerResult = {
  process: ChildProcess
  url: string
  port: number
  cleanup: () => Promise<void>
}

/**
 * Result type for CLI output capture
 */
export type CliOutputResult = {
  output: string
  exitCode: number | null
  process: ChildProcess
}

/**
 * RLS Testing types
 */
export interface RoleContext {
  /** PostgreSQL database role to SET ROLE to (e.g., 'member_user', 'admin_user') */
  dbRole?: string
  /** Application user ID to set in app.user_id session variable */
  userId?: string
  /** Application user role to set in app.user_role session variable */
  userRole?: string
}

export type ExecuteQueryFn = (
  query: string | string[],
  params?: unknown[]
) => Promise<{
  rows: any[]
  rowCount: number
  [key: string]: any
}>

export interface RlsPolicyInfo {
  schemaname: string
  tablename: string
  policyname: string
  permissive: string
  roles: string[]
  cmd: string
  qual: string | null
  with_check: string | null
}

export interface QuerySuccessOptions {
  /** Minimum number of rows expected (default: 0) */
  minRows?: number
  /** Maximum number of rows expected */
  maxRows?: number
  /** Exact number of rows expected */
  exactRows?: number
  /** Fields that must be present in results */
  requiredFields?: string[]
  /** Fields that must NOT be present in results (for field-level permission tests) */
  forbiddenFields?: string[]
}

/**
 * Server fixture types
 */
export type ServerFixtures = {
  // Browser locale for i18n testing
  browserLocale: string | undefined

  // Analytics mocking to prevent flakiness
  mockAnalytics: boolean

  // Request context
  request: APIRequestContext

  // Server startup with schema
  startServerWithSchema: (
    appSchema: App,
    options?: {
      useDatabase?: boolean
      database?: { url?: string }
      adminBootstrap?: {
        email?: string
        password?: string
        name?: string
      }
    }
  ) => Promise<void>

  // Database query execution
  executeQuery: ExecuteQueryFn

  // Static site generation
  generateStaticSite: (
    appSchema: App,
    config?: {
      baseUrl?: string
      basePath?: string
      deployment?: string
      languages?: string[]
      defaultLanguage?: string
      generateSitemap?: boolean
      generateRobotsTxt?: boolean
      hydration?: boolean
      generateManifest?: boolean
      bundleOptimization?: 'none' | 'basic' | 'aggressive'
      publicDir?: string
    }
  ) => Promise<string>

  // CLI server with config file
  startCliServerWithConfig: (options: {
    config: object | string
    format: 'json' | 'yaml' | 'yml'
    port?: number
    hostname?: string
    databaseUrl?: string
  }) => Promise<{ url: string; port: number }>

  // Auth fixtures
  signUp: (data: SignUpData) => Promise<AuthResult>
  signIn: (data: SignInData) => Promise<AuthResult>
  signOut: () => Promise<void>
  createAuthenticatedUser: (data?: Partial<SignUpData>) => Promise<AuthResult>
  createAuthenticatedAdmin: (data?: Partial<SignUpData>) => Promise<AuthResult>
  createAuthenticatedViewer: (data?: Partial<SignUpData>) => Promise<AuthResult>
  createAuthenticatedMember: (data?: Partial<SignUpData>) => Promise<AuthResult>

  // Email testing
  mailpit: MailpitHelper

  // API Key fixtures
  createApiKey: (data?: ApiKeyCreateData) => Promise<ApiKeyResult>
  listApiKeys: () => Promise<ApiKey[]>
  deleteApiKey: (keyId: string) => Promise<void>
  createApiKeyAuth: (data?: ApiKeyCreateData) => Promise<{ headers: { Authorization: string } }>

  // Two-Factor fixtures
  enableTwoFactor: () => Promise<TwoFactorSetupResult>
  verifyTwoFactor: (code: string) => Promise<TwoFactorVerifyResult>
  disableTwoFactor: (code: string) => Promise<void>
  generateTotpCode: (secret: string) => string

  // Admin fixtures
  adminCreateUser: (data: AdminCreateUserData) => Promise<AdminUserResult>
  adminBanUser: (userId: string) => Promise<void>
  adminUnbanUser: (userId: string) => Promise<void>
  adminListUsers: (filters?: {
    search?: string
    role?: string
    banned?: boolean
  }) => Promise<{ users: AuthUser[] }>
  adminSetRole: (userId: string, role: string) => Promise<void>
}
