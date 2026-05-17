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
 * - _shared: Pagination, timestamps, error responses (cross-cutting)
 * - activity: Activity log endpoints
 * - ai: AI chat, MCP, memory, RAG endpoints
 * - analytics: Page analytics endpoints
 * - auth: Authentication and authorization endpoints
 * - automations: Automation run endpoints
 * - connections: Connection authorization and per-user roster endpoints
 * - health: Health check endpoint
 * - notifications: Notification inbox and preferences endpoints
 * - realtime: WebSocket/SSE real-time subscription endpoints
 * - tables: Table, record, comment, view, search, webhook endpoints
 */

// Cross-cutting schemas
export * from './_shared'

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

// Connection schemas
export * from './connections'

// Health check schemas
export * from './health'

// Notification schemas
export * from './notifications'

// Real-time subscription schemas
export * from './realtime'

// Table, record, comment, view, search, and webhook schemas
export * from './tables'
