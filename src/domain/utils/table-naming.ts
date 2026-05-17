/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Sanitize table name for PostgreSQL identifier
 *
 * Converts table names from user-friendly format to PostgreSQL-safe identifiers:
 * - Converts to lowercase
 * - Replaces spaces with underscores
 * - Removes special characters
 * - Ensures result matches pattern ^[a-z_]+$
 *
 * Examples:
 * - "My Projects" -> "my_projects"
 * - "User-Data" -> "user_data"
 * - "Sales 2024" -> "sales_2024"
 *
 * @param tableName - User-provided table name from schema
 * @returns Sanitized table name safe for PostgreSQL
 */
export const sanitizeTableName = (tableName: string): string =>
  tableName
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
