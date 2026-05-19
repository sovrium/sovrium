/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { parseQueryIntent } from '@/domain/services/ai-chat-query-parser'
import { runQuery, type QueryTableWithPerms } from './chat-query'
import { projectAppTables } from './chat-table-projection'
import type { ChatAction } from '@/domain/models/api/ai/chat'
import type { App } from '@/domain/models/app'
import type { ContextPageScope } from '@/domain/services/ai-chat-context'

export type QueryTurnResult =
  | { readonly kind: 'none' }
  | { readonly kind: 'forbidden'; readonly message: string }
  | {
      readonly kind: 'answered'
      readonly action: ChatAction
      readonly reply: string
    }

export interface QueryTurnInput {
  readonly app: App | undefined
  readonly message: string
  readonly sessionId: string
  readonly userRole: string
  readonly pageContext?: ContextPageScope | undefined
}

const lastQueriedTable = new Map<string, string>()

const toQueryTables = (
  app: App | undefined,
  pageContext: ContextPageScope | undefined
): ReadonlyArray<QueryTableWithPerms> =>
  projectAppTables(app, {
    ...(pageContext?.allowedTables !== undefined && {
      allowedTables: pageContext.allowedTables,
    }),
  })

export const evaluateQueryTurn = async (input: QueryTurnInput): Promise<QueryTurnResult> => {
  const tables = toQueryTables(input.app, input.pageContext)
  if (tables.length === 0) return { kind: 'none' }

  const fallback =
    lastQueriedTable.get(input.sessionId) ?? (tables.length === 1 ? tables[0]?.name : undefined)
  const intent = parseQueryIntent(input.message, tables, fallback)
  if (intent === undefined) return { kind: 'none' }

  const outcome = await runQuery({ intent, userRole: input.userRole, tables })
  if (outcome.status === 'forbidden') {
    return { kind: 'forbidden', message: outcome.message }
  }
  lastQueriedTable.set(input.sessionId, intent.table)
  return { kind: 'answered', action: outcome.action, reply: outcome.reply }
}
