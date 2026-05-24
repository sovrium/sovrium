/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { type Context } from 'hono'
import type { McpCaller } from './auth'

export interface SchemaToolCallInput {
  readonly c: Readonly<Context>
  readonly caller: McpCaller
  readonly responseId: number | string
  readonly appName: string
  readonly toolName: string
  readonly args: Record<string, unknown>
}

export type SchemaToolResultBuilder = (input: SchemaToolCallInput, structured: unknown) => Response
