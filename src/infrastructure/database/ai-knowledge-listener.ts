/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Client } from 'pg'
import { runSyncDocumentsAtStartup } from '@/infrastructure/ai/document-sync'
import {
  buildKnowledgeBindings,
  embedKnowledgeRecord,
  removeKnowledgeRecordEmbeddings,
  runSyncKnowledgeAtStartup,
} from '@/infrastructure/ai/knowledge-sync'
import { logDebug } from '@/infrastructure/logging/logger'
import { isSqliteRuntime } from './unsupported-in-sqlite'
import type { RagAgent } from '@/infrastructure/ai/rag-agent-input'


export interface KnowledgeTableBinding {
  readonly agentName: string
  readonly table: string
  readonly fields: ReadonlyArray<string>
  readonly filter?: Readonly<Record<string, unknown>>
}

interface KnowledgePayload {
  readonly op: 'INSERT' | 'UPDATE' | 'DELETE'
  readonly table: string
  readonly id: string
}

const CHANNEL = 'sovrium_ai_knowledge'

const buildTriggerSql = (table: string): readonly string[] => {
  const fn = `sovrium_ai_knowledge_notify_${table}`
  const trig = `sovrium_ai_knowledge_trig_${table}`
  const quoted = `"${table.replace(/"/g, '""')}"`
  return [
    `CREATE OR REPLACE FUNCTION ${fn}() RETURNS trigger AS $$
       DECLARE rec_id text;
       BEGIN
         IF (TG_OP = 'DELETE') THEN rec_id := OLD.id::text;
         ELSE rec_id := NEW.id::text;
         END IF;
         PERFORM pg_notify('${CHANNEL}', json_build_object(
           'op', TG_OP, 'table', '${table}', 'id', rec_id
         )::text);
         IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
       END;
     $$ LANGUAGE plpgsql`,
    `DROP TRIGGER IF EXISTS ${trig} ON ${quoted}`,
    `CREATE TRIGGER ${trig} AFTER INSERT OR UPDATE OR DELETE ON ${quoted}
       FOR EACH ROW EXECUTE FUNCTION ${fn}()`,
  ]
}

export class AiKnowledgeListener {
  private client: Client | undefined = undefined
  private stopped = false

  constructor(
    private readonly databaseUrl: string,
    private readonly bindings: ReadonlyArray<KnowledgeTableBinding>
  ) {}

  private get tables(): ReadonlyArray<string> {
    return [...new Set(this.bindings.map((b) => b.table))]
  }

  private bindingsFor(table: string): ReadonlyArray<KnowledgeTableBinding> {
    return this.bindings.filter((b) => b.table === table)
  }

  async start(): Promise<void> {
    if (this.bindings.length === 0) return
    const client = new Client({ connectionString: this.databaseUrl })
    await client.connect()
    this.client = client

    await Promise.all(
      this.tables.map((table) =>
        buildTriggerSql(table).reduce(
          (chain, stmt) =>
            chain.then(() =>
              client.query(stmt).then(
                () => undefined,
                () => undefined
              )
            ),
          Promise.resolve()
        )
      )
    )

    client.on('notification', (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return
      this.handlePayload(msg.payload).catch((error: unknown) => {
        logDebug(`[ai-knowledge] payload handler error: ${String(error)}`)
      })
    })
    client.on('error', () => {
    })
    await client.query(`LISTEN ${CHANNEL}`)
  }

  async stop(): Promise<void> {
    this.stopped = true
    const { client } = this
    this.client = undefined
    if (client) {
      try {
        await client.query(`UNLISTEN ${CHANNEL}`)
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
    if (!payload) return
    const bindings = this.bindingsFor(payload.table)
    if (bindings.length === 0) return

    await Promise.all(
      bindings.map((binding) =>
        payload.op === 'DELETE'
          ? removeKnowledgeRecordEmbeddings({
              agentName: binding.agentName,
              table: binding.table,
              recordId: payload.id,
            }).catch(() => undefined)
          :
            embedKnowledgeRecord({
              agentName: binding.agentName,
              table: binding.table,
              fields: binding.fields,
              filter: binding.filter,
              recordId: payload.id,
            }).catch(() => undefined)
      )
    )
  }
}

const listenerHolder: { current: AiKnowledgeListener | undefined } = { current: undefined }

export const startAiKnowledgeListener = async (
  databaseUrl: string,
  bindings: ReadonlyArray<KnowledgeTableBinding>
): Promise<void> => {
  if (bindings.length === 0) return
  if (isSqliteRuntime()) {
    logDebug('[ai-knowledge] listener disabled — requires PostgreSQL (SQLite runtime)')
    return
  }
  if (listenerHolder.current) {
    await listenerHolder.current.stop().catch(() => undefined)
  }
  const listener = new AiKnowledgeListener(databaseUrl, bindings)
  listenerHolder.current = listener
  await listener.start().catch((error: unknown) => {
    logDebug(`[ai-knowledge] listener failed to start: ${String(error)}`)
  })
}

export const stopAiKnowledgeListener = async (): Promise<void> => {
  const listener = listenerHolder.current
  listenerHolder.current = undefined
  if (listener) await listener.stop().catch(() => undefined)
}

export const runRagKnowledgeStartup = async (
  agents: ReadonlyArray<RagAgent> | undefined,
  databaseUrl: string
): Promise<void> => {
  if (isSqliteRuntime()) {
    logDebug('[ai-rag] knowledge startup disabled — requires PostgreSQL (SQLite runtime)')
    return
  }
  await runSyncDocumentsAtStartup()
  await runSyncKnowledgeAtStartup({ agents })
  await startAiKnowledgeListener(databaseUrl, buildKnowledgeBindings(agents))
}

const parsePayload = (raw: string): KnowledgePayload | undefined => {
  try {
    const parsed = JSON.parse(raw) as KnowledgePayload
    if (
      (parsed.op === 'INSERT' || parsed.op === 'UPDATE' || parsed.op === 'DELETE') &&
      typeof parsed.table === 'string' &&
      typeof parsed.id === 'string'
    ) {
      return parsed
    }
    return undefined
  } catch {
    return undefined
  }
}
