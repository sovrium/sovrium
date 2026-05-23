/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq } from 'drizzle-orm'
import { type Context } from 'hono'
import { db } from '@/infrastructure/database'
import {
  authOauthAccessTokensTable,
  authUsersTable,
} from '@/infrastructure/database/drizzle/dialect-schema'
import type { McpAuthStrategy } from '@/domain/models/env/mcp'


export type McpCallerRole = 'admin' | 'member' | 'viewer'

export interface McpCaller {
  readonly role: McpCallerRole
  readonly userId: string | undefined
}

export interface McpAuthConfig {
  readonly authStrategy: McpAuthStrategy
  readonly tokenAdmin: string | undefined
  readonly tokenMember: string | undefined
  readonly tokenViewer: string | undefined
}

export const resolveCallerRole = async (
  c: Readonly<Context>,
  config: McpAuthConfig
): Promise<McpCallerRole | undefined> => {
  const caller = await resolveCaller(c, config)
  return caller?.role
}

export const resolveCaller = async (
  c: Readonly<Context>,
  config: McpAuthConfig
): Promise<McpCaller | undefined> => {
  const presented = readBearerToken(c)
  if (!presented) return undefined

  if (config.authStrategy === 'oauth2') {
    return resolveOauthCaller(presented)
  }
  const role = resolveStaticTokenRole(presented, config)
  if (role === undefined) return undefined
  return { role, userId: undefined }
}

export const readBearerToken = (c: Readonly<Context>): string | undefined => {
  const authHeader = c.req.header('Authorization') ?? ''
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i)
  return bearerMatch?.[1]
}

const resolveStaticTokenRole = (
  presented: string,
  config: McpAuthConfig
): McpCallerRole | undefined => {
  if (presented === config.tokenAdmin) return 'admin'
  if (presented === config.tokenMember) return 'member'
  if (presented === config.tokenViewer) return 'viewer'
  return undefined
}

const resolveOauthCaller = async (token: string): Promise<McpCaller | undefined> => {
  try {
    const oauthAccessTokens = authOauthAccessTokensTable()
    const users = authUsersTable()
    const hashed = await hashAccessToken(token)
    const rows = await db
      .select({ userId: oauthAccessTokens.userId, expiresAt: oauthAccessTokens.expiresAt })
      .from(oauthAccessTokens)
      .where(eq(oauthAccessTokens.token, hashed))
      .limit(1)
    const accessToken = rows[0]
    if (!accessToken) return undefined
    if (accessToken.expiresAt.getTime() <= Date.now()) return undefined
    if (!accessToken.userId) return undefined

    const userRows = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, accessToken.userId))
      .limit(1)
    const userRole = userRows[0]?.role ?? undefined
    return { role: mapUserRoleToMcpRole(userRole), userId: accessToken.userId }
  } catch {
    return undefined
  }
}

const hashAccessToken = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return base64UrlEncode(new Uint8Array(digest))
}

const base64UrlEncode = (bytes: Uint8Array): string => {
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('')
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const mapUserRoleToMcpRole = (role: string | undefined): McpCallerRole => {
  if (role === 'admin') return 'admin'
  if (role === 'viewer') return 'viewer'
  return 'member'
}

export const buildOauthWwwAuthenticate = (
  c: Readonly<Context>,
  config: McpAuthConfig
): string | undefined => {
  if (config.authStrategy !== 'oauth2') return undefined
  const baseUrl = resolveBaseUrl(c)
  return (
    `Bearer realm="mcp", ` +
    `as_uri="${baseUrl}/.well-known/oauth-authorization-server", ` +
    `resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`
  )
}

const resolveBaseUrl = (c: Readonly<Context>): string => {
  const explicit = process.env['BASE_URL']
  if (explicit && explicit.length > 0) return explicit
  try {
    const url = new URL(c.req.url)
    return `${url.protocol}//${url.host}`
  } catch {
    return `http://localhost:${process.env['PORT'] ?? '3000'}`
  }
}
