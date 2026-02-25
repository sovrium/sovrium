/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
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
 * Schema Organization:
 * - common: Pagination, timestamps, generic responses
 * - error: Error response formats
 * - health: Health check endpoint
 * - auth: Authentication and authorization
 * - tables: Table and record operations
 * - request: Request input validation
 */

// Analytics schemas
export * from './analytics'

// Common schemas
export * from './common'

// Error schemas
export * from './error'

// Health check schemas
export * from './health'

// Authentication schemas
export * from './auth'

// Table and record schemas
export * from './tables'

// Request schemas (input validation)
export * from './request'
