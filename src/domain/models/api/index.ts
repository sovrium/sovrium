/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API Schema Exports
 *
 * This module exports the Effect Schema wire contracts used for API response
 * validation and OpenAPI documentation generation.
 *
 * Organization: every child directory is a canonical slug, and a route group
 * whose URL segment is not a slug lives inside the slug it folds into.
 * - (root files): the shared envelope — pagination, timestamps, error
 *   responses, the search term, schema defaults
 * - activity: Activity log endpoints
 * - ai: AI chat, MCP, memory, RAG endpoints
 * - analytics: Page analytics endpoints
 * - auth: Authentication, account self-service & GDPR, SCIM 2.0 provisioning
 * - automations: Automation runs, the caller's notifications and preferences
 * - buckets: Public bucket file endpoints
 * - connections: Connection authorization and per-user roster endpoints
 * - realtime: WebSocket/SSE real-time subscription endpoints
 * - search: What the ⌘K palette of an app finds: pages and readable records
 * - server: Health check endpoints
 * - tables: Table, record, comment, view, search, webhook endpoints
 */

// The shared envelope
export * from './common'
export * from './cursor-pagination'
export * from './error'
export * from './search-term'

// Activity log schemas
export * from './activity'

// AI schemas (chat, MCP, memory, RAG)
export * from './ai'

// Analytics schemas
export * from './analytics'

// Authentication, account self-service & GDPR, and SCIM 2.0 provisioning schemas
export * from './auth'

// Automation schemas, and the caller's own notifications and notification preferences
export * from './automations'

// Public bucket file schemas
export * from './buckets'

// Connection schemas
export * from './connections'

// Real-time subscription schemas
export * from './realtime'

// What the ⌘K palette of an app finds: pages and readable records
export * from './search'

// Health check schemas
export * from './server'

// Table, record, comment, view, search, and webhook schemas
export * from './tables'
