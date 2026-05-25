/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { z } from '@hono/zod-openapi'
import { actorSchema } from '@/domain/models/api/admin/_shared/actor'
import { resourceSchema } from '@/domain/models/api/admin/_shared/resource'
import { severitySchema } from '@/domain/models/api/admin/_shared/severity'

export const auditResultSchema = z
  .enum(['success', 'failure'])
  .describe('Outcome of the audited action — used for filtering during triage.')

export type AuditResult = z.infer<typeof auditResultSchema>

export const auditLogEntrySchema = z
  .object({
    id: z.string().describe('Stable opaque identifier for this audit entry.'),
    timestamp: z.iso.datetime().describe('ISO 8601 UTC timestamp when the entry was emitted.'),
    action: z.string().describe('Dot-namespaced action name (e.g. `config.version.queried`).'),
    actor: actorSchema,
    resource: resourceSchema,
    severity: severitySchema,
    result: auditResultSchema,
    metadata: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Domain-specific extras attached by the emitter; omit when empty.'),
  })
  .openapi('AuditLogEntry')

export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>

export const auditLogListResponseSchema = z
  .object({
    items: z.array(auditLogEntrySchema),
    nextCursor: z.string().nullable(),
  })
  .openapi('AuditLogListResponse')

export type AuditLogListResponse = z.infer<typeof auditLogListResponseSchema>

export const auditLogQuerySchema = z
  .object({
    actorId: z.string().optional(),
    action: z.string().optional(),
    resourceType: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().max(200).default(50),
  })
  .openapi('AuditLogQuery')

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>
