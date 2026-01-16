/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
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
import { validateFilterFieldPermissions } from '@/presentation/api/utils/filter-field-validator'
import { getRecord, deleteRecord } from '@/presentation/api/utils/table-queries'
import { hasCreatePermission, hasDeletePermission } from './permissions'
import {
  createListRecordsProgram,
  createGetRecordProgram,
  createRecordProgram,
  updateRecordProgram,
  restoreRecordProgram,
} from './programs'
import {
  getSessionFromContext,
  validateAndGetTableName,
  getUserRole,
  isAuthorizationError,
} from './utils'
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
        const filterParam = c.req.query('filter')
        if (filterParam) {
          try {
            const filter = JSON.parse(filterParam)
            const forbiddenFields = validateFilterFieldPermissions(app, tableName, userRole, filter)

            if (forbiddenFields.length > 0) {
              return c.json(
                {
                  error: 'Forbidden',
                  message: `Cannot filter by field: ${forbiddenFields[0]}`,
                },
                403
              )
            }
          } catch {
            // If JSON parsing fails, return 400 Bad Request
            return c.json(
              {
                error: 'Bad Request',
                message: 'Invalid filter parameter',
              },
              400
            )
          }
        }

        return runEffect(
          c,
          createListRecordsProgram(session, tableName, app, userRole),
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
      // eslint-disable-next-line complexity -- Error handling for authorization requires multiple checks
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
          // Check if error indicates authorization failure or record not found
          // Effect wraps errors, so check both message and error name
          const errorMessage = error instanceof Error ? error.message : String(error)
          const errorName = error instanceof Error ? error.name : ''
          const errorString = String(error)

          // Check if it's a SessionContextError (authorization/not found)
          if (
            errorMessage.includes('Record not found') ||
            errorMessage.includes('not found') ||
            errorMessage.includes('access denied') ||
            errorName.includes('SessionContextError') ||
            errorString.includes('SessionContextError')
          ) {
            // Return 404 for authorization failures to prevent enumeration
            return c.json({ error: 'Record not found' }, 404)
          }

          // For other errors, return 500
          return c.json(
            {
              error: 'Internal server error',
              message: errorMessage,
            },
            500
          )
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

        // Validate field write permissions and filter out forbidden fields
        const forbiddenFields = validateFieldWritePermissions(app, tableName, userRole, result.data)

        // Filter data to only include fields the user has permission to write
        const allowedFieldsData = Object.fromEntries(
          Object.entries(result.data).filter(([fieldName]) => !forbiddenFields.includes(fieldName))
        )

        // If no fields remain after filtering, return 403
        if (Object.keys(allowedFieldsData).length === 0) {
          return c.json(
            {
              error: 'Forbidden',
              message: `You do not have permission to modify any of the specified fields: ${forbiddenFields.join(', ')}`,
            },
            403
          )
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
              const readResult = await Effect.runPromise(getRecord(session, tableName, recordId))

              // If we can read the record but couldn't update it, return 403 Forbidden
              if (readResult !== null) {
                return c.json(
                  { error: 'Forbidden: You do not have permission to update this record' },
                  403
                )
              }

              // If we can't read the record either, return 404 Not Found
              return c.json({ error: 'Record not found' }, 404)
            } catch {
              // If getRecord also fails, return 404 (record doesn't exist or not readable)
              return c.json({ error: 'Record not found' }, 404)
            }
          }

          return c.json(
            {
              error: 'Internal server error',
              message: error instanceof Error ? error.message : 'Unknown error',
            },
            500
          )
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
            deleteRecord(session, tableName, c.req.param('recordId'))
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

          return c.json(
            {
              error: 'Internal server error',
              message: error instanceof Error ? error.message : 'Unknown error',
            },
            500
          )
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
          // Handle specific error messages
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'

          if (errorMessage === 'Record not found') {
            return c.json({ error: 'Record not found' }, 404)
          }

          if (errorMessage === 'Record is not deleted') {
            return c.json({ error: 'Bad Request', message: 'Record is not deleted' }, 400)
          }

          return c.json(
            {
              error: 'Internal server error',
              message: errorMessage,
            },
            500
          )
        }
      })
  )
}

/* eslint-enable drizzle/enforce-delete-with-where */
