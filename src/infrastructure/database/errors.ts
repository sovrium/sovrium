/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Re-export domain error types for infrastructure-layer consumers
 *
 * Error classes are now defined in @/domain/errors (the domain layer)
 * where they belong. This file re-exports them so existing infrastructure
 * imports continue to work without changes.
 */
export {
  DatabaseError,
  NotFoundError,
  ForbiddenError,
  ForeignKeyViolationError,
  UniqueConstraintViolationError,
  ValidationError,
} from '@/domain/errors'
