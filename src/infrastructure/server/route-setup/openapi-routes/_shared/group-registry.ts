/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { accountGroup } from '../account-routes'
import { activeScopeGroup } from '../active-scope-routes'
import { activityGroup } from '../activity-routes'
import { adminGroup } from '../admin-routes'
import { agentCollectionGroup, agentGroupSpec } from '../agents-routes'
import { aiChatGroup } from '../ai-chat-routes'
import { aiConversationGroup } from '../ai-conversations-routes'
import { aiFactsGroup } from '../ai-facts-routes'
import { analyticsGroup } from '../analytics-routes'
import { authGroup } from '../auth-routes'
import { automationCollectionGroup, automationGroupSpec } from '../automations-routes'
import { batchGroupSpec } from '../batch-routes'
import { bucketGroupSpec } from '../buckets-routes'
import { connectionGroupSpec } from '../connections-routes'
import { formGroupSpec } from '../forms-routes'
import { healthGroup } from '../health-routes'
import { mcpGroup } from '../mcp-routes'
import { ragGroup } from '../rag-routes'
import { recordsGroupSpec } from '../record-routes'
import { tableCollectionGroup, tableGroupSpec } from '../table-routes'
import { viewGroupSpec } from '../view-routes'
import type { ResourceGroupSpec, StaticGroupSpec } from './route-spec'
import type { App } from '@/domain/models/app'


type TagSpec = { readonly name: string; readonly description: string }

export const RESOURCE_GROUPS: readonly ResourceGroupSpec[] = [
  tableGroupSpec,
  recordsGroupSpec,
  batchGroupSpec,
  viewGroupSpec,
  automationGroupSpec,
  formGroupSpec,
  connectionGroupSpec,
  bucketGroupSpec,
  agentGroupSpec,
]

export const STATIC_GROUPS: readonly StaticGroupSpec[] = [
  healthGroup,
  tableCollectionGroup,
  activityGroup,
  analyticsGroup,
  authGroup,
  accountGroup,
  aiChatGroup,
  aiConversationGroup,
  ragGroup,
  automationCollectionGroup,
  adminGroup,
  agentCollectionGroup,
  aiFactsGroup,
  mcpGroup,
  activeScopeGroup,
]

export const buildTags = (app?: App): readonly TagSpec[] => {
  const resourceTags = RESOURCE_GROUPS.flatMap((group): readonly TagSpec[] => {
    const resources = app === undefined ? [] : group.collection(app)
    return resources.length === 0
      ? [{ name: group.genericTag, description: group.genericTagDescription }]
      : resources.map((resource) => ({
          name: `${group.tagPrefix}: ${resource.name}`,
          description: `Endpoints for the '${resource.name}' ${group.tagPrefix.toLowerCase()}`,
        }))
  })
  const staticTags = STATIC_GROUPS.map(
    (group): TagSpec => ({ name: group.tag, description: group.tagDescription })
  )
  const byName = new Map([...staticTags, ...resourceTags].map((tag) => [tag.name, tag]))
  return [...byName.values()]
}
