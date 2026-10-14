/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { loadAgentSkills } from '@/infrastructure/ai/skills/agent-skills-live'
import { assetProjectDir } from '@/infrastructure/assets/private-assets'

/**
 * The boot's agent-skill check, without the boot: every reason the server would
 * refuse to load the skills its agents list, empty when it would load them.
 *
 * The same function the boot calls (`loadAgentSkills`), anchored the same way
 * (`assetProjectDir` of the config file), so `sovrium validate` and `sovrium
 * start` cannot disagree about a skill. Each issue already names its agent.
 */
export const agentSkillIssues = async (
  agents: readonly { readonly name: string; readonly skills?: readonly string[] }[] | undefined,
  configFile: string | undefined
): Promise<readonly string[]> => {
  if (!(agents ?? []).some((agent) => (agent.skills ?? []).length > 0)) return []
  const outcome = await loadAgentSkills(agents, assetProjectDir(configFile))
  return outcome.ok ? [] : outcome.issues
}
