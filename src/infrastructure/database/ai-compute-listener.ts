/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { Client } from 'pg'
import { refineAiComputeField } from '@/application/use-cases/ai-compute/refine-field'
import { AiLive } from '@/infrastructure/ai/layer'
import { logDebug } from '@/infrastructure/logging/logger'
import { isSqliteRuntime } from './unsupported-in-sqlite'
import type { AiComputeKind } from '@/domain/services/ai-compute/baseline'
import type { AiComputeRequestConfig } from '@/domain/services/ai-compute/build-request'

interface AiComputePayload {
  readonly kind?:
    | 'categorize'
    | 'summary'
    | 'translate'
    | 'extract'
    | 'sentiment'
    | 'generate'
    | 'tag'
  readonly table: string
  readonly field: string
  readonly record_id?: string | number
  readonly value: string | undefined
  readonly source: string
  readonly categories?: readonly string[]
  readonly prompt?: string | null
  readonly systemPrompt?: string | null
  readonly model?: string | null
  readonly temperature?: number | null
  readonly maxLength?: number | null
  readonly maxTokens?: number | null
  readonly targetLanguage?: string
  readonly schema?: string
}

export class AiComputeListener {
  private client: Client | undefined = undefined
  private stopped = false

  constructor(
    private readonly databaseUrl: string,
    private readonly appId: string
  ) {}

  async start(): Promise<void> {
    if (isSqliteRuntime()) {
      logDebug('[ai-compute] listener disabled — requires PostgreSQL (SQLite runtime)')
      return
    }

    const client = new Client({ connectionString: this.databaseUrl })
    await client.connect()
    this.client = client

    client.on('notification', (msg) => {
      if (msg.channel !== 'sovrium_ai_compute' || !msg.payload) return
      this.handlePayload(msg.payload).catch((error: unknown) => {
        logDebug(`[ai-compute] payload handler error: ${String(error)}`)
      })
    })

    client.on('error', () => {
    })

    await client.query('LISTEN sovrium_ai_compute')
  }

  async stop(): Promise<void> {
    this.stopped = true
    const { client } = this
    this.client = undefined
    if (client) {
      try {
        await client.query('UNLISTEN sovrium_ai_compute')
      } catch {
      }
      try {
        await client.end()
      } catch {
      }
    }
  }

  private async handlePayload(raw: string): Promise<void> {
    if (this.stopped) return

    const payload = parsePayload(raw)
    if (!payload || payload.record_id === undefined || payload.record_id === null) return

    const kind = resolveKind(payload.kind)
    const config = toRequestConfig(payload)

    const program = refineAiComputeField({
      appId: this.appId,
      tableName: payload.table,
      recordId: String(payload.record_id),
      fieldName: payload.field,
      kind,
      source: payload.source,
      baselineValue: payload.value,
      config,
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(AiLive), Effect.either))
    if (result._tag === 'Left') {
      logDebug(`[ai-compute] refinement program failed: ${String(result.left)}`)
    }
  }
}

const resolveKind = (kind: AiComputePayload['kind']): AiComputeKind => {
  switch (kind) {
    case 'summary':
      return 'ai-summary'
    case 'translate':
      return 'ai-translate'
    case 'extract':
      return 'ai-extract'
    case 'sentiment':
      return 'ai-sentiment'
    case 'generate':
      return 'ai-generate'
    case 'tag':
      return 'ai-tag'
    case 'categorize':
    case undefined:
      return 'ai-categorize'
  }
}

const toRequestConfig = (payload: AiComputePayload): AiComputeRequestConfig => ({
  prompt: payload.prompt,
  systemPrompt: payload.systemPrompt,
  model: payload.model,
  temperature: payload.temperature,
  maxTokens: payload.maxTokens,
  maxLength: payload.maxLength,
  ...(payload.categories !== undefined ? { categories: payload.categories } : {}),
  ...(payload.targetLanguage !== undefined ? { targetLanguage: payload.targetLanguage } : {}),
  ...(payload.schema !== undefined ? { schema: payload.schema } : {}),
})

const parsePayload = (raw: string): AiComputePayload | undefined => {
  try {
    return JSON.parse(raw) as AiComputePayload
  } catch {
    return undefined
  }
}
