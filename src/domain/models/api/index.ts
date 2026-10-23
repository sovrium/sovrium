/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API Schema Exports
 *
 * This module exports all Zod schemas used for API response validation
 * and OpenAPI documentation generation.
 *
 * Schema Organization (by API route domain):
 * - combinators: Pagination, timestamps, error responses (cross-cutting)
 * - account: Account self-service & GDPR endpoints (export, deletion)
 * - activity: Activity log endpoints
 * - ai: AI chat, MCP, memory, RAG endpoints
 * - analytics: Page analytics endpoints
 * - auth: Authentication and authorization endpoints
 * - automations: Automation run endpoints
 * - buckets: Public bucket file endpoints
 * - connections: Connection authorization and per-user roster endpoints
 * - health: Health check endpoint
 * - notifications: The caller's notifications and notification preferences
 * - realtime: WebSocket/SSE real-time subscription endpoints
 * - scim: SCIM 2.0 provisioning endpoints
 * - tables: Table, record, comment, view, search, webhook endpoints
 */

// Cross-cutting schemas
export * from './combinators'

// Account self-service & GDPR schemas (export, deletion)
export * from './account'

// Activity log schemas
export * from './activity'

// AI schemas (chat, MCP, memory, RAG)
export * from './ai'

// Analytics schemas
export * from './analytics'

// Authentication schemas
export * from './auth'

// Automation schemas
export * from './automations'

// Public bucket file schemas
export * from './buckets'

// Connection schemas
export * from './connections'

// Health check schemas
export * from './health'

// The caller's own notifications and notification preferences
export * from './notifications'

// Real-time subscription schemas
export * from './realtime'

// What the ⌘K palette of an app finds: pages and readable records
export * from './command-search'

// SCIM 2.0 provisioning schemas
export * from './scim'

// Table, record, comment, view, search, and webhook schemas
export * from './tables'

// The people a user field resolves to, with their presence facts
export * from './users'
