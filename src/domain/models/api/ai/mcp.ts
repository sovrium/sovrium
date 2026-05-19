/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'


export const mcpServerStatusSchema = z.object({
  enabled: z.literal(true),
  transport: z.string(),
  mountPath: z.string(),
})

export const mcpClientServerSchema = z.object({
  url: z.string(),
  authType: z.enum(['bearer', 'header', 'none']),
  headerName: z.string().optional(),
  status: z.literal('connecting'),
})

export const mcpClientStatusSchema = z.object({
  enabled: z.literal(true),
  servers: z.array(mcpClientServerSchema),
})

export const mcpClientToolSchema = z.object({ name: z.string(), description: z.string() })

export const mcpClientToolsSchema = z.object({
  enabled: z.literal(true),
  tools: z.array(mcpClientToolSchema),
})

export const mcpDisabledSchema = z.object({ enabled: z.literal(false), error: z.string() })

export type McpServerStatus = z.infer<typeof mcpServerStatusSchema>
export type McpClientServer = z.infer<typeof mcpClientServerSchema>
export type McpClientStatus = z.infer<typeof mcpClientStatusSchema>
export type McpClientTool = z.infer<typeof mcpClientToolSchema>
export type McpClientTools = z.infer<typeof mcpClientToolsSchema>
export type McpDisabled = z.infer<typeof mcpDisabledSchema>
