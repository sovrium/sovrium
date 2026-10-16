/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The addresses of this app that its own pages frame.
 *
 * Every response refuses to be framed (`frame-ancestors 'none'`), which also
 * refuses an `iframe` whose `src` is a page or a file of the same app — the
 * author asked for it, and the browser drew an empty box. The exception is
 * granted per ADDRESS and only from the configuration: a path an `iframe` of
 * the app's own pages names answers `frame-ancestors 'self'`, and nothing
 * else does. That is narrower than a site-wide `'self'`: the sign-in page, the
 * console and every address no page frames keep refusing every frame, same
 * origin included, so nothing on this origin can be drawn under a decoy
 * unless the author framed it on purpose.
 *
 * Only a `/`-relative `src` counts, its query and fragment dropped (the policy
 * is a property of the address, not of one request to it). A protocol-relative
 * (`//…`) or absolute URL names another origin as far as configuration can
 * tell, and a `$`-reference is unresolved here, so neither grants anything.
 */

import {
  placedTemplatesOf,
  renderedNodesWhere,
  type ComponentTreeSource,
  type TreeNode,
} from './component-tree-has-type'

const isIframe = (node: TreeNode): boolean => node['type'] === 'iframe'

/** The same-origin path an iframe `src` names, or `undefined` when it names none. */
export const sameOriginFramePath = (src: unknown): string | undefined => {
  if (typeof src !== 'string' || !src.startsWith('/')) return undefined
  if (src.startsWith('//') || src.startsWith('/\\')) return undefined
  const path = src.split(/[?#]/)[0] ?? ''
  return path.length > 0 ? path : undefined
}

/** The `src` of one iframe node. */
const srcOf = (node: TreeNode): unknown => {
  const { props } = node
  return typeof props === 'object' && props !== null
    ? (props as Readonly<Record<string, unknown>>)['src']
    : undefined
}

/** Every path of this app an `iframe` on one of its pages names. */
export const selfFramedPaths = (app: ComponentTreeSource): ReadonlySet<string> => {
  const templates = app.components ?? []
  const paths = (app.pages ?? []).flatMap((page) => {
    const items = page.components ?? []
    return renderedNodesWhere(items, placedTemplatesOf(items, templates), isIframe).flatMap(
      (node) => {
        const path = sameOriginFramePath(srcOf(node))
        return path === undefined ? [] : [path]
      }
    )
  })
  return new Set(paths)
}
