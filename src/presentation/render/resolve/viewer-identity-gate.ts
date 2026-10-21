/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `$user.id` / `$user.email` conditions of a page that renders WITHOUT a
 * session — a mounted operator console — judged against the viewer's identity.
 *
 * A mounted page is session-less on purpose (role, groups and the session stay
 * out, so nothing can be read as a role or reach a row filter), which left a
 * `$user.*` comparison resolving to nothing: `$user.email neq $param.email`
 * held on the reader's OWN account page, and the gestures it gated stayed.
 * The route hands the renderer the viewer's id and email instead, and this
 * pass answers exactly the conditions that compare one of those two fields:
 *
 *   - a condition that does NOT hold removes the node and its subtree, as the
 *     session gate would (exclusion, never `display: none`);
 *   - a condition that holds is answered, and taken off the node, so the
 *     session gate that runs next does not judge it again without a session;
 *   - any other condition — `$user.role`, `$user.twoFactorEnabled` — is left
 *     untouched for the session gate, which resolves it to nothing, as before.
 *
 * It runs BEFORE the session gates, and only on a session-less render: with a
 * session, the session gate answers every `$user.*` field itself. A `command`'s
 * authored rows are not judged here: the console declares no identity gate on
 * one, and the session gate keeps judging them as before.
 */

import {
  viewerConditionVerdict,
  visibilityOf,
  type ViewerIdentity,
} from '@/domain/models/app/pages/component-session-visibility-service'
import { pruneNodes } from '@/presentation/render/resolve/visibility-filter'
import type { Page } from '@/domain/models/app/pages'

/**
 * The node with its answered `visibility.condition` removed, from the position
 * {@link visibilityOf} read it at: `props.visibility` first, then the root.
 */
const withoutCondition = (node: object): object => {
  const { props } = node as { readonly props?: Readonly<Record<string, unknown>> }
  const fromProps = props?.['visibility']
  if (typeof fromProps === 'object' && fromProps !== null) {
    const { condition: _answered, ...rest } = fromProps as Readonly<Record<string, unknown>>
    return { ...node, props: { ...props, visibility: rest } }
  }
  const { condition: _answered, ...rest } = visibilityOf<Record<string, unknown>>(node) ?? {}
  return { ...node, visibility: rest }
}

/**
 * Resolve every `$user.id` / `$user.email` condition of `components` against
 * `identity`, at any depth. `undefined` identity — a standalone app, or a render
 * that has a session — returns the tree unchanged.
 */
export function applyViewerIdentityConditions(
  components: Page['components'],
  identity: ViewerIdentity | undefined
): Page['components'] {
  if (!components || identity === undefined) return components
  return pruneNodes(components, {
    keep: (node) => viewerConditionVerdict(node, identity) !== false,
    reshape: (node) =>
      viewerConditionVerdict(node, identity) === true ? withoutCondition(node) : node,
  }) as Page['components']
}
