/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

const PRECEDENCE_KEYWORDS: ReadonlySet<string> = new Set([
  'local-first',
  'cloud-first',
  'local-only',
])

export const parseEcoAiProviderPrecedenceList = (
  processEnv: Readonly<Record<string, string | undefined>>
): readonly string[] => {
  const raw = processEnv['ECO_AI_PROVIDER_PRECEDENCE']?.trim()
  if (raw === undefined || raw === '') return []
  if (PRECEDENCE_KEYWORDS.has(raw)) return []
  return raw
    .split(',')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
}
