/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createContext, useContext } from 'react'

/**
 * The API-key manager's own words (`apiKeys.*`), resolved on the server in the
 * console's language and sent only where they differ from English. Provided
 * once at the island root; empty by default, so a manager mounted without a
 * provider draws English.
 */
export const ApiKeyStringsContext = createContext<Readonly<Record<string, string>>>({})

/** One of the manager's words: the page's when the server sent it, else English. */
export function useApiKeyWord(key: string, english: string): string {
  return useContext(ApiKeyStringsContext)[`apiKeys.${key}`] ?? english
}
