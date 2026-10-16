/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createContext, useContext } from 'react'

/**
 * The conversation viewer's own words (`agentConversations.*`), resolved on the
 * server in the console's language and sent only where they differ from
 * English. Provided once at the island root; empty by default, so a viewer
 * mounted without a provider draws English.
 */
export const AgentConversationStringsContext = createContext<Readonly<Record<string, string>>>({})

/** One of the viewer's words: the page's when the server sent it, else English. */
export function useAgentConversationString(key: string, english: string): string {
  return useContext(AgentConversationStringsContext)[`agentConversations.${key}`] ?? english
}
