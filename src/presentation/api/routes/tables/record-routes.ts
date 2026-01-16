/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  hasCreatePermission,
  hasDeletePermission,
} from '@/application/use-cases/tables/permissions/permissions'
import {
  createListRecordsProgram,
  createGetRecordProgram,
  createRecordProgram,
  updateRecordProgram,
  restoreRecordProgram,
  rawGetRecordProgram,
  deleteRecordProgram,
} from '@/application/use-cases/tables/programs'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { transformRecord } from '@/application/use-cases/tables/utils/record-transformer'
import {
  createRecordRequestSchema,
  updateRecordRequestSchema,
} from '@/presentation/api/schemas/request-schemas'
import {
  listRecordsResponseSchema,
  getRecordResponseSchema,
  createRecordResponseSchema,
} from '@/presentation/api/schemas/tables-schemas'
import { runEffect, validateRequest } from '@/presentation/api/utils'
import { validateFieldWritePermissions } from '@/presentation/api/utils/field-permission-validator'
import {
  handleGetRecordError,
  handleRestoreRecordError,
  handleInternalError,
} from './error-handlers'
import { parseFilterParameter } from './filter-parser'
import { getSessionFromContext, validateAndGetTableName, isAuthorizationError } from './utils'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

/* eslint-disable drizzle/enforce-delete-with-where -- These are Hono route methods, not Drizzle queries */

// eslint-disable-next-line max-lines-per-function -- Route chaining requires more lines for session extraction and auth checks
export function chainRecordRoutesMethods<T extends Hono>(honoApp: T, app: App) {
  return (
    honoApp
      .get('/api/tables/:tableId/records', async (c) => {
        // Extract session from context (set by auth middleware)
        const session = getSessionFromContext(c)
        if (!session) {
          return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
        }

        // Get table name from route parameter
        const tableId = c.req.param('tableId')
        const tableName = validateAndGetTableName(app, tableId)
        if (!tableName) {
          return c.json({ error: 'Not Found', message: `Table ${tableId} not found` }, 404)
        }

        // Query user role from database (for field-level read permissions)
        const userRole = await getUserRole(session.userId, session.activeOrganizationId)

        // Parse and validate filter parameter if present
        const parsedFilterResult = parseFilterParameter({
          filterParam: c.req.query('filter'),
          app,
          tableName,
          userRole,
          c,
        })

        if (!parsedFilterResult.success) {
          return parsedFilterResult.error
        }

        const parsedFilter = parsedFilterResult.filter

        return runEffect(
          c,
          createListRecordsProgram({ session, tableName, app, userRole, filter: parsedFilter }),
          listRecordsResponseSchema
        )
      })
      .post('/api/tables/:tableId/records', async (c) => {
        const session = getSessionFromContext(c)
        if (!session) {
          return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
        }

        const result = await validateRequest(c, createRecordRequestSchema)
        if (!result.success) return result.response

        // Get table name from route parameter
        const tableId = c.req.param('tableId')
        const tableName = validateAndGetTableName(app, tableId)
        if (!tableName) {
          return c.json({ error: 'Not Found', message: `Table ${tableId} not found` }, 404)
        }

        // Query user role from database
        const userRole = await getUserRole(session.userId, session.activeOrganizationId)

        // Check table-level create permissions
        const table = app.tables?.find((t) => t.name === tableName)
        if (!hasCreatePermission(table, userRole)) {
          return c.json(
            {
              error: 'Forbidden',
              message: 'You do not have permission to create records in this table',
            },
            403
          )
        }

        // Validate field write permissions
        const forbiddenFields = validateFieldWritePermissions(
          app,
          tableName,
          userRole,
          result.data.fields
        )

        if (forbiddenFields.length > 0) {
          return c.json(
            {
              error: 'Forbidden',
              message: `You do not have permission to modify field(s): ${forbiddenFields.join(', ')}`,
            },
            403
          )
        }

        return runEffect(
          c,
          createRecordProgram(session, tableName, result.data.fields),
          createRecordResponseSchema,
          201
        )
      })
      .get('/api/tables/:tableId/records/:recordId', async (c) => {
        const session = getSessionFromContext(c)
        if (!session) {
          return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
        }

        // Get table name from route parameter
        const tableId = c.req.param('tableId')
        const tableName = validateAndGetTableName(app, tableId)
        if (!tableName) {
          return c.json({ error: 'Not Found', message: `Table ${tableId} not found` }, 404)
        }

        // Query user role from database (for field-level read permissions)
        const userRole = await getUserRole(session.userId, session.activeOrganizationId)

        try {
          const program = createGetRecordProgram({
            session,
            tableName,
            recordId: c.req.param('recordId'),
            app,
            userRole,
          })
          const result = await Effect.runPromise(program)
          const validated = getRecordResponseSchema.parse(result)
          return c.json(validated, 200)
        } catch (error) {
          return handleGetRecordError(c, error)
        }
      })
      // eslint-disable-next-line max-lines-per-function, max-statements, complexity -- TODO: Refactor this handler into smaller functions
      .patch('/api/tables/:tableId/records/:recordId', async (c) => {
        const session = getSessionFromContext(c)
        if (!session) {
          return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
        }

        const result = await validateRequest(c, updateRecordRequestSchema)
        if (!result.success) return result.response

        // Get table name from route parameter
        const tableId = c.req.param('tableId')
        const tableName = validateAndGetTableName(app, tableId)
        if (!tableName) {
          return c.json({ error: 'Not Found', message: `Table ${tableId} not found` }, 404)
        }

        // Query user role from database (check org-specific role first)
        const userRole = await getUserRole(session.userId, session.activeOrganizationId)

        // Check table-level update permissions
        const table = app.tables?.find((t) => t.name === tableName)
        const updatePermission = table?.permissions?.update

        if (updatePermission?.type === 'roles') {
          const allowedRoles = updatePermission.roles || []
          if (!allowedRoles.includes(userRole)) {
            return c.json(
              {
                error: 'Forbidden',
                message: 'You do not have permission to update records in this table',
              },
              403
            )
          }
        }

        // System-protected fields that should never be user-modifiable
        const systemProtectedFields = new Set(['organization_id', 'user_id', 'owner_id'])

        // Validate field write permissions and filter out forbidden fields
        const forbiddenFields = validateFieldWritePermissions(app, tableName, userRole, result.data)

        // Filter data to only include fields the user has permission to write
        // Also filter out system-protected fields (silently ignored)
        const allowedFieldsData = Object.fromEntries(
          Object.entries(result.data).filter(
            ([fieldName]) =>
              !forbiddenFields.includes(fieldName) && !systemProtectedFields.has(fieldName)
          )
        )

        // If no fields remain after filtering and user tried to modify forbidden fields,
        // return 403 only if they're not system-protected fields (which are silently ignored)
        const attemptedForbiddenFields = forbiddenFields.filter(
          (field) => !systemProtectedFields.has(field)
        )
        if (Object.keys(allowedFieldsData).length === 0 && attemptedForbiddenFields.length > 0) {
          return c.json(
            {
              error: 'Forbidden',
              message: `You do not have permission to modify any of the specified fields: ${attemptedForbiddenFields.join(', ')}`,
            },
            403
          )
        }

        // If only system-protected fields were filtered out, fetch and return unchanged record
        if (Object.keys(allowedFieldsData).length === 0) {
          try {
            const recordId = c.req.param('recordId')
            const record = await Effect.runPromise(
              rawGetRecordProgram(session, tableName, recordId)
            )

            if (!record) {
              return c.json({ error: 'Record not found' }, 404)
            }

            return c.json({ record: transformRecord(record) }, 200)
          } catch (error) {
            return handleGetRecordError(c, error)
          }
        }

        // Execute update with RLS enforcement (using only allowed fields)
        try {
          const updateResult = await Effect.runPromise(
            updateRecordProgram(session, tableName, c.req.param('recordId'), allowedFieldsData)
          )

          // Check if update affected any rows (RLS may have blocked it)
          if (!updateResult.record || Object.keys(updateResult.record).length === 0) {
            return c.json({ error: 'Record not found' }, 404)
          }

          return c.json(updateResult, 200)
        } catch (error) {
          // Check if this is an authorization error (RLS blocking the update)
          if (isAuthorizationError(error)) {
            // Check if the record exists with read permission
            try {
              const recordId = c.req.param('recordId')
              const readResult = await Effect.runPromise(
                rawGetRecordProgram(session, tableName, recordId)
              )

              // If we can read the record but couldn't update it, return 403 Forbidden
              if (readResult !== null) {
                return c.json(
                  { error: 'Forbidden: You do not have permission to update this record' },
                  403
                )
              }

              return c.json({ error: 'Record not found' }, 404)
            } catch {
              return c.json({ error: 'Record not found' }, 404)
            }
          }

          return handleInternalError(c, error)
        }
      })
      .delete('/api/tables/:tableId/records/:recordId', async (c) => {
        const session = getSessionFromContext(c)
        if (!session) {
          return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
        }

        // Get table name from route parameter
        const tableId = c.req.param('tableId')
        const tableName = validateAndGetTableName(app, tableId)
        if (!tableName) {
          return c.json({ error: 'Not Found', message: `Table ${tableId} not found` }, 404)
        }

        // Query user role from database
        const userRole = await getUserRole(session.userId, session.activeOrganizationId)

        // Check table-level delete permissions
        const table = app.tables?.find((t) => t.name === tableName)
        if (!hasDeletePermission(table, userRole)) {
          return c.json(
            {
              error: 'Forbidden',
              message: 'You do not have permission to delete records in this table',
            },
            403
          )
        }

        try {
          const deleted = await Effect.runPromise(
            deleteRecordProgram(session, tableName, c.req.param('recordId'))
          )

          if (!deleted) {
            return c.json({ error: 'Record not found' }, 404)
          }

          // eslint-disable-next-line unicorn/no-null -- Hono's c.body() requires null for empty responses
          return c.body(null, 204) // 204 No Content
        } catch (error) {
          // Return 404 for authorization failures to prevent enumeration
          if (isAuthorizationError(error)) {
            return c.json({ error: 'Record not found' }, 404)
          }
          return handleInternalError(c, error)
        }
      })
      .post('/api/tables/:tableId/records/:recordId/restore', async (c) => {
        const session = getSessionFromContext(c)
        if (!session) {
          return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
        }

        // Get table name from route parameter
        const tableId = c.req.param('tableId')
        const tableName = validateAndGetTableName(app, tableId)
        if (!tableName) {
          return c.json({ error: 'Not Found', message: `Table ${tableId} not found` }, 404)
        }

        try {
          const result = await Effect.runPromise(
            restoreRecordProgram(session, tableName, c.req.param('recordId'))
          )

          return c.json(result, 200)
        } catch (error) {
          return handleRestoreRecordError(c, error)
        }
      })
  )
}

/* eslint-enable drizzle/enforce-delete-with-where */
