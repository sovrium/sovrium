/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveInterpreterStringOverrides } from '@/domain/models/app/languages/translation-resolver'
import type { Languages } from '@/domain/models/app/languages'

/**
 * The islands a page mounts from a plain container — `props['data-island']`
 * and a serialised `props['data-island-props']`, with no renderer of their own
 * to resolve their words — and the catalogue prefixes each one draws.
 */
const RAW_ISLAND_STRING_PREFIXES: Readonly<Record<string, readonly string[]>> = {
  'admin-agent-conversations': ['agentConversations.'],
  'api-key-manager': ['apiKeys.'],
}

/** The serialised props, parsed, or `undefined` when they are not a JSON object. */
const parseIslandProps = (json: string): Record<string, unknown> | undefined => {
  try {
    const parsed: unknown = JSON.parse(json)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

/**
 * Hand a container-mounted island its words in the page language: the same
 * `uiStrings` prop a component renderer resolves for its island, merged into
 * the serialised props, and only the strings that differ from the English the
 * island is written in — so an English page's markup is unchanged. Any other
 * props come back as they are.
 */
export function withRawIslandUiStrings(
  props: Record<string, unknown> | undefined,
  currentLang: string | undefined,
  languages: Languages | undefined
): Record<string, unknown> | undefined {
  const island = props?.['data-island']
  const json = props?.['data-island-props']
  const prefixes = typeof island === 'string' ? RAW_ISLAND_STRING_PREFIXES[island] : undefined
  if (prefixes === undefined || typeof json !== 'string') return props
  const uiStrings = resolveInterpreterStringOverrides(prefixes, currentLang, languages)
  const parsed = parseIslandProps(json)
  if (uiStrings === undefined || parsed === undefined) return props
  return { ...props, 'data-island-props': JSON.stringify({ ...parsed, uiStrings }) }
}
