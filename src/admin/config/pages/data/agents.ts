/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Conversations — every thread your users had with an agent, one viewer per agent.
//
// THREE pages, and the third is the interesting one:
//
//   `/conversations`          the bare collection, which always 302s — there is always
//                      a first agent, because the built-in `system` agent
//                      leads the projection.
//   `/conversations/system`   the built-in System Agent, whose viewer holds every
//                      conversation no declared agent claimed.
//   `/conversations/:agent`   one declared agent's viewer.
//
// ─── WHY `system` IS ITS OWN PAGE AND NOT A BRANCH ─────────────────────────
//
// The two differ by ONE sentence — the orienting blurb has to say what the
// System Agent IS, and that sentence is false for a declared agent.
// Config has no way to branch a body on a route parameter: `visibility.condition`
// reads `$user.*`, not `$param.*`, and widening it to route state would make a
// component's presence depend on the URL rather than on who is asking, which is a
// different primitive with a different security surface.
//
// Route ORDER answers it instead, at no cost: `findMatchingRoute` takes the
// first pattern that matches, with no static-over-dynamic precedence, so a
// literal page listed BEFORE the `:agent` page wins `/conversations/system` and the
// param page never sees it. Order is therefore load-bearing here in a way it is
// not on the other surfaces — reversing these two silently deletes the sentence.
//
// The blurb is worded from the ROW (`agent_name IS NULL`), not from the caller's
// intent, and stays that way even though the two now agree. They did not always:
// `POST /api/ai/chat { agent: 'x' }` used to persist NULL despite naming a
// declared agent. This copy names what the operator will actually find in the
// list, and that stays true whatever a future transport does.

import dashboardDataAgentsAgent from './dashboard-data-agents-agent.page.json'
import dashboardDataAgentsSystem from './dashboard-data-agents-system.page.json'
import dashboardDataAgents from './dashboard-data-agents.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default [
  dashboardDataAgents as PageConfig,
  dashboardDataAgentsSystem as PageConfig,
  dashboardDataAgentsAgent as PageConfig,
] satisfies readonly PageConfig[]
