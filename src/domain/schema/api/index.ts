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
 * - common-schemas: Pagination, timestamps, generic responses
 * - error-schemas: Error response formats
 * - health-schemas: Health check endpoint
 * - auth-schemas: Authentication and authorization
 * - tables-schemas: Table and record operations
 */

// Common schemas
export * from './common-schemas'

// Error schemas
export * from './error-schemas'

// Health check schemas
export * from './health-schemas'

// Authentication schemas
export * from './auth-schemas'

// Table and record schemas
export * from './tables-schemas'

// Request schemas (input validation)
export * from './request-schemas'
