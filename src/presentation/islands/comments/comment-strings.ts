/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createContext, useContext } from 'react'

/**
 * The thread's own interface strings (`comments.*`: the composer, the reply
 * form, the sort control), resolved on the server against the page language and
 * the author's translations, and sent only where they differ from English — so
 * the map is empty on an English page and every control keeps its English
 * literal. No catalog ships to the browser.
 *
 * Local to this island on purpose: a strings module shared with another island
 * becomes a chunk of its own, and every chunk adds an entry to the eager island
 * loader's preload map.
 */
export type CommentStrings = Readonly<Record<string, string>>

/** Provided once at the thread's root; empty (English) without a provider. */
export const CommentStringsContext = createContext<CommentStrings>({})

/** One thread interface string: the server-resolved text, or the English literal. */
export function useCommentString(key: string, english: string): string {
  return useContext(CommentStringsContext)[key] ?? english
}
