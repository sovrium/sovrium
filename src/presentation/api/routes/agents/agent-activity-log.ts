/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { recordActivityLogRow } from '../ai/chat-activity-log'

export interface AgentActivityLogEntry {
  readonly actorName: string
  readonly action: string
  readonly targetTable: string | undefined
}

export const recordAgentActivity = async (entry: AgentActivityLogEntry): Promise<void> =>
  recordActivityLogRow({
    actorType: 'agent',
    actorName: entry.actorName,
    action: entry.action,
    targetTable: entry.targetTable,
  })
